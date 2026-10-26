import type { SupabaseClient } from "@supabase/supabase-js";
import { hashInvitationToken, track } from "@/lib/invitations/server";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { cycleStart } from "@/lib/narration/credits";
import { accessEnd, chargeSchedule, giftMonth, LIVE_SEATS, type SeatStatus, type SponsorPlan, type SponsorshipStatus } from "./rules";
import { sponsorshipFacts } from "./server";

/**
 * What each side may see. The sponsor sees, per family: its name, whether it joined, whether its parents
 * approved the sponsor's own voice (yes or waiting, never for which children), and its credit share and
 * how many it used, as a number. Never children, books, listening or other storytellers.
 */

type Row = Record<string, unknown>;

async function q(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<Row[]> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as Row[];
}

const iso = (v: unknown): string | null => (typeof v === "string" && v ? new Date(v).toISOString() : null);
const DAY = 86_400_000;

export type PlaceState = "arrives" | "invited" | "opened" | "joined" | "removal_scheduled" | "ended";

export interface PlaceView {
  seat: number;
  name: string;
  state: PlaceState;
  /** When the invitation was opened, or the family joined. */
  openedAt: string | null;
  joinedAt: string | null;
  /** The sponsor's voice in this family: not offered, waiting for the parents, or approved for at least one child. */
  voice: "not_shared" | "waiting" | "approved";
  creditShare: number;
  nextShare: number | null;
  nextFrom: string | null;
  /** Gift credits used this gift month, as a whole-number-ish count. Never which stories. */
  usedThisMonth: number;
  /** Last moment of access when a removal is scheduled. */
  accessUntil: string | null;
}

export interface GiftView {
  id: string;
  plan: SponsorPlan;
  status: SponsorshipStatus;
  priceCents: number;
  paidAt: string;
  deliverAt: string;
  startsAt: string | null;
  paidThrough: string | null;
  endsAt: string | null;
  /** The month a credit split made today would start. */
  nextMonthFrom: string | null;
  /** Monthly: the next charge date, while renewing. */
  nextChargeAt: string | null;
  giverName: string;
  places: PlaceView[];
  /** Free places that can be offered to another family. */
  freePlaces: number[];
  canChangeFamilies: boolean;
}

/** The label a place shows (pure). */
export function placeState(seat: { status: SeatStatus }, delivered: boolean, opened: boolean): PlaceState {
  if (seat.status === "active") return "joined";
  if (seat.status === "removal_scheduled") return "removal_scheduled";
  if (seat.status === "invited") return !delivered ? "arrives" : opened ? "opened" : "invited";
  return "ended";
}

/** Every gift the sponsor gave, newest first, with only what the sponsor may see. */
export async function sponsorGifts(db: SupabaseClient, sponsorId: string, now = new Date()): Promise<GiftView[]> {
  const gifts = await q(db.from("sponsorships").select("*").eq("sponsor_id", sponsorId).neq("status", "awaiting_payment").order("created_at", { ascending: false }), "read gifts");
  if (!gifts.length) return [];
  const ids = gifts.map((g) => g.id as string);
  const [seats, voices] = await Promise.all([
    q(db.from("sponsorship_seats").select("*").in("sponsorship_id", ids), "read places"),
    q(db.from("voice_profiles").select("id").eq("owner_id", sponsorId).is("deleted_at", null), "read sponsor voices"),
  ]);
  const seatIds = seats.map((s) => s.id as string);
  const homes = seats.map((s) => s.household_id as string | null).filter((h): h is string => Boolean(h));
  const voiceIds = voices.map((v) => v.id as string);
  // Children are read only to match approvals to a family; nothing about them leaves this function.
  const children = homes.length ? await q(db.from("child_profiles").select("id, household_id").in("household_id", homes).is("deleted_at", null), "read families") : [];
  const childHome = new Map(children.map((c) => [c.id as string, c.household_id as string]));
  const [invitations, shares, approvalRows, plans, ledger] = await Promise.all([
    seatIds.length ? q(db.from("sponsorship_invitations").select("seat_id, opened_at, accepted_at, revoked_at").in("seat_id", seatIds), "read invitations") : [],
    homes.length && voiceIds.length ? q(db.from("voice_household_shares").select("household_id").in("household_id", homes).in("voice_id", voiceIds).is("revoked_at", null), "read shares") : [],
    children.length && voiceIds.length ? q(db.from("child_voice_approvals").select("child_id").in("child_id", [...childHome.keys()]).in("voice_id", voiceIds).is("revoked_at", null), "read approvals") : [],
    homes.length ? q(db.from("household_entitlements").select("id, household_id, sponsorship_id, starts_at").eq("source", "sponsored").in("household_id", homes), "read gift plans") : [],
    homes.length ? q(db.from("narration_credit_ledger").select("household_id, lot_id, credits").eq("kind", "commit").in("household_id", homes), "read credit use") : [],
  ]);

  const approvals = approvalRows.map((a) => ({ household_id: childHome.get(a.child_id as string) }));
  return gifts.map((g) => {
    const facts = sponsorshipFacts(g);
    const delivered = Boolean(g.delivered_at);
    const mine = seats.filter((s) => s.sponsorship_id === g.id);
    const visible = mine
      .filter((s) => LIVE_SEATS.includes(s.status as SeatStatus) || (s.household_id && (s.status === "removed" || s.status === "canceled")))
      .sort((a, b) => (a.seat as number) - (b.seat as number) || String(b.created_at).localeCompare(String(a.created_at)));
    // One row per place: the live family, else the most recent one that had it.
    const places: PlaceView[] = [];
    for (const s of visible) {
      if (places.some((p) => p.seat === s.seat)) continue;
      const inv = invitations.filter((i) => i.seat_id === s.id).sort((a, b) => String(b.opened_at ?? "").localeCompare(String(a.opened_at ?? "")))[0];
      const home = s.household_id as string | null;
      const plan = plans.find((p) => p.household_id === home && p.sponsorship_id === g.id);
      const lotPrefix = plan ? `subscription:${plan.id}:${cycleStart(plan.starts_at as string, now.toISOString()).slice(0, 10)}` : null;
      const used = lotPrefix ? ledger.filter((l) => l.household_id === home && l.lot_id === lotPrefix).reduce((n, l) => n + Number(l.credits ?? 0), 0) : 0;
      places.push({
        seat: s.seat as number,
        name: s.recipient_name as string,
        state: placeState({ status: s.status as SeatStatus }, delivered, Boolean(inv?.opened_at)),
        openedAt: iso(inv?.opened_at),
        joinedAt: iso(s.accepted_at),
        voice: !home || !s.share_voice || !shares.some((x) => x.household_id === home) ? "not_shared" : approvals.some((x) => x.household_id === home) ? "approved" : "waiting",
        creditShare: Number(s.credit_share ?? 0),
        nextShare: s.next_credit_share == null ? null : Number(s.next_credit_share),
        nextFrom: iso(s.next_credits_from),
        // Ledger credits are characters; the sponsor sees whole credits.
        usedThisMonth: Math.round((used / DEFAULT_PLAN.charactersPerCredit) * 10) / 10,
        accessUntil: iso(s.access_until),
      });
    }
    const live = mine.filter((s) => LIVE_SEATS.includes(s.status as SeatStatus)).map((s) => s.seat as number);
    const offered = mine.filter((s) => delivered && Date.parse(String(s.created_at)) > Date.parse(String(g.delivered_at)) && Date.parse(String(s.created_at)) > now.getTime() - 365 * DAY).length;
    const renewing = facts.plan === "monthly" && ["active", "past_due"].includes(facts.status);
    return {
      id: g.id as string,
      plan: facts.plan,
      status: facts.status,
      priceCents: Number(g.price_cents),
      paidAt: iso(g.created_at) ?? now.toISOString(),
      deliverAt: iso(g.deliver_at)!,
      startsAt: iso(g.starts_at),
      paidThrough: iso(g.paid_through) ?? chargeSchedule(facts.plan, new Date(g.deliver_at as string)).paidThrough.toISOString(),
      endsAt: iso(g.ends_at),
      nextMonthFrom: facts.startsAt ? giftMonth(facts.startsAt, now).end.toISOString() : null,
      nextChargeAt: renewing ? iso(g.paid_through) : null,
      giverName: g.giver_display_name as string,
      places,
      freePlaces: [1, 2].filter((n) => !live.includes(n)),
      canChangeFamilies: offered < 2,
    };
  });
}

export interface InvitationLanding {
  status: "ready" | "joined" | "expired" | "invalid" | "not_ready";
  giverName: string;
  recipientName: string;
  message: string;
  plan: SponsorPlan;
  sharesVoice: boolean;
  creditShare: number;
  /** When the gift's paid access ends, if known (the year's end, or a scheduled end). */
  endsAt: string | null;
}

/** The family's landing page for a gift link. Visiting it marks the invitation opened, once. */
export async function invitationLanding(db: SupabaseClient, token: string, now = new Date()): Promise<InvitationLanding | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const inv = (await q(db.from("sponsorship_invitations").select("*").eq("token_hash", hashInvitationToken(token)), "read gift invitation"))[0];
  if (!inv) return null;
  const seat = (await q(db.from("sponsorship_seats").select("*").eq("id", inv.seat_id as string), "read place"))[0];
  const sp = seat && (await q(db.from("sponsorships").select("*").eq("id", seat.sponsorship_id as string), "read gift"))[0];
  if (!seat || !sp) return null;
  const status: InvitationLanding["status"] = inv.accepted_at
    ? "joined"
    : inv.revoked_at || seat.status !== "invited"
      ? "invalid"
      : Date.parse(inv.expires_at as string) <= now.getTime()
        ? "expired"
        : !sp.delivered_at || !["active", "past_due"].includes(sp.status as string)
          ? "not_ready"
          : "ready";
  if (status === "ready" && !inv.opened_at) {
    await q(db.from("sponsorship_invitations").update({ opened_at: now.toISOString() }).eq("id", inv.id as string).is("opened_at", null), "mark opened");
    await track(db, "sponsor_invitation_opened", { sponsorship_id: sp.id, seat: seat.seat });
  }
  const end = accessEnd(sponsorshipFacts(sp), { accessUntil: null });
  return {
    status,
    giverName: sp.giver_display_name as string,
    recipientName: seat.recipient_name as string,
    message: (sp.message as string | null) ?? "",
    plan: sp.plan as SponsorPlan,
    sharesVoice: seat.share_voice === true,
    creditShare: Number(seat.credit_share ?? 0),
    endsAt: end?.toISOString() ?? null,
  };
}

export interface HouseholdGift {
  sponsorshipId: string;
  giverName: string;
  plan: SponsorPlan;
  startsAt: string | null;
  /** First moment without the gift, when known. */
  endsAt: string | null;
  creditShare: number;
  nextShare: number | null;
  nextFrom: string | null;
}

/** The gift covering a family now, as its parents see it on Plan and billing. */
export async function householdGift(db: SupabaseClient, householdId: string): Promise<HouseholdGift | null> {
  const seat = (await q(db.from("sponsorship_seats").select("*").eq("household_id", householdId).in("status", ["active", "removal_scheduled"]), "read gift place"))[0];
  if (!seat) return null;
  const sp = (await q(db.from("sponsorships").select("*").eq("id", seat.sponsorship_id as string), "read gift"))[0];
  if (!sp) return null;
  const end = accessEnd(sponsorshipFacts(sp), { accessUntil: seat.access_until ? new Date(seat.access_until as string) : null });
  return {
    sponsorshipId: sp.id as string,
    giverName: sp.giver_display_name as string,
    plan: sp.plan as SponsorPlan,
    startsAt: iso(sp.starts_at),
    endsAt: end?.toISOString() ?? null,
    creditShare: Number(seat.credit_share ?? 0),
    nextShare: seat.next_credit_share == null ? null : Number(seat.next_credit_share),
    nextFrom: iso(seat.next_credits_from),
  };
}

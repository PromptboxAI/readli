import type { SupabaseClient } from "@supabase/supabase-js";
import type { StripeApi } from "@/lib/billing/stripe-api";
import { addMonths } from "@/lib/narration/credits";
import { normalizeGiftCode } from "./codes";
import { hashGiftCode } from "./codes.server";
import { giftPlan, type GiftPlan } from "./plans";

/**
 * Gift redemption for real accounts (gifts, migration 000500). The code is looked up by its hash.
 * Redeeming runs redeem_gift, which gives the recipient's own family (created if they have none) the
 * Readli Family plan for the gift's months, after any time they already have. Recipients never
 * enter a card, and nothing converts to a paid plan when the gift ends.
 */
export class GiftError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface GiftLanding {
  plan: GiftPlan;
  to: string;
  from: string;
  message: string;
  status: "ready" | "redeemed" | "unavailable";
}

const UNCLAIMED_MS = 365 * 86_400_000;

/** What the recipient sees before claiming: the card, never the giver's account or payment. */
export async function giftForCode(db: SupabaseClient, code: string, now = new Date()): Promise<GiftLanding | null> {
  const normalized = normalizeGiftCode(code);
  if (!normalized) return null;
  const { data, error } = await db
    .from("gifts")
    .select("plan_id, status, recipient_name, giver_display_name, message, sent_at, redeemed_at")
    .eq("code_hash", hashGiftCode(normalized))
    .limit(1);
  if (error) throw new Error(`read gift: ${error.message}`);
  const g = (data ?? [])[0] as Record<string, unknown> | undefined;
  const plan = g && giftPlan(g.plan_id as string);
  if (!g || !plan) return null;
  const sentAt = g.sent_at ? new Date(g.sent_at as string) : null;
  const status =
    g.redeemed_at || g.status === "active" || g.status === "ended"
      ? "redeemed"
      : g.status === "sent" && !(sentAt && now.getTime() - sentAt.getTime() > UNCLAIMED_MS)
        ? "ready"
        : "unavailable";
  return { plan, to: (g.recipient_name as string | null) ?? "", from: g.giver_display_name as string, message: (g.message as string | null) ?? "", status };
}

const REASONS: [RegExp, number, string, string][] = [
  [/gift not found/, 404, "gift_not_found", "We couldn't find that gift code. Check it and try again."],
  [/already redeemed/, 409, "gift_redeemed", "This gift has already been opened."],
  [/cancelled/, 410, "gift_cancelled", "This gift was cancelled, so it can't be opened."],
  [/unclaimed/, 410, "gift_expired", "This gift link has expired. Ask the person who sent it to get in touch with us."],
  [/not ready/, 409, "gift_not_ready", "This gift isn't ready to open yet."],
  [/own gift/, 403, "own_gift", "You can't open a gift you sent. Share the code with the person it's for."],
  [/subscriber must confirm/, 409, "confirm_billing_pause", "You already pay for Readli Family. Please confirm how this gift fits with your plan first."],
];

export interface RedeemOptions {
  /** The family's name when claiming creates their family. */
  familyName?: string;
  /** The subscriber agreed to pause their paid billing for the gift's months. */
  deferBilling?: boolean;
  /** Needed when deferBilling is set. */
  stripe?: StripeApi | null;
}

export interface Redeemed {
  householdId: string;
  paidThrough: string;
  /** True when a paid subscription's billing was paused for the gift instead of adding a separate plan. */
  billingPaused?: boolean;
  /** The redeemed gift, so follow-ups (a Readli Gives Back welcome) can find it. */
  giftId?: string;
}

export async function redeemGiftCode(db: SupabaseClient, code: string, user: { id: string; name: string }, opts: RedeemOptions = {}): Promise<Redeemed> {
  const normalized = normalizeGiftCode(code);
  if (!normalized) throw new GiftError(400, "bad_code", "That doesn't look like a gift code. It's 12 letters and numbers, like ABCD-EFGH-JKMN.");
  if (opts.deferBilling && !opts.stripe) throw new GiftError(503, "billing_unavailable", "We can't pause your paid plan right now, so your gift wasn't used. Please try again later or contact us.");
  const familyName = opts.familyName?.replace(/\s+/g, " ").trim().slice(0, 120) || `${user.name}'s family`;
  const args: Record<string, unknown> = { p_code_hash: hashGiftCode(normalized), p_user: user.id, p_family_name: familyName };
  if (opts.deferBilling) args.p_defer_billing = true;
  const { data, error } = await db.rpc("redeem_gift", args);
  if (error) {
    const hit = REASONS.find(([re]) => re.test(error.message));
    if (hit) throw new GiftError(hit[1], hit[2], hit[3]);
    throw new Error(`redeem gift: ${error.message}`);
  }
  const row = (Array.isArray(data) ? data[0] : data) as { household_id: string; paid_through: string | null; gift_id?: string; months?: number; subscription_ref?: string | null };
  if (row.subscription_ref && row.gift_id) {
    const paidThrough = await pauseSubscriptionForGift(db, opts.stripe!, { giftId: row.gift_id, subscriptionRef: row.subscription_ref, months: row.months ?? 12 });
    return { householdId: row.household_id, paidThrough, billingPaused: true, giftId: row.gift_id };
  }
  return { householdId: row.household_id, paidThrough: row.paid_through as string, ...(row.gift_id ? { giftId: row.gift_id } : {}) };
}

/** When the subscription's current paid time runs out: the later of its period end and any free time already given. */
export function subscriptionPaidUntil(sub: { current_period_end?: number; trial_end?: number | null; items?: { data?: { current_period_end?: number }[] } }): string | null {
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  const ends = [periodEnd, sub.trial_end ?? undefined].filter((v): v is number => typeof v === "number");
  return ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null;
}

/**
 * An existing subscriber claimed a gift (Kevin, 2026-10-22): rather than a second plan running alongside
 * the one they pay for, Stripe stops billing until their paid time plus the gift's months is over, then
 * the plan carries on as before. No refund, no charge, no paid time lost. If Stripe refuses, the claim
 * is undone so the gift can be tried again.
 */
export async function pauseSubscriptionForGift(db: SupabaseClient, stripe: StripeApi, gift: { giftId: string; subscriptionRef: string; months: number }): Promise<string> {
  let until: string;
  try {
    const sub = await stripe.getSubscription(gift.subscriptionRef);
    const paidUntil = subscriptionPaidUntil(sub);
    if (!paidUntil || !["active", "trialing"].includes(sub.status) || sub.cancel_at_period_end) throw new Error(`subscription ${sub.status} can't be paused`);
    until = addMonths(paidUntil, gift.months);
    await stripe.pauseBillingUntil(gift.subscriptionRef, Math.floor(new Date(until).getTime() / 1000), `readli-gift-pause-${gift.giftId}`);
  } catch (err) {
    const { error } = await db
      .from("gifts")
      .update({ status: "sent", redeemed_at: null, recipient_user_id: null, billing_deferral: null })
      .eq("id", gift.giftId)
      .eq("billing_deferral", "pending");
    if (error) throw new Error(`undo gift claim: ${error.message}`);
    console.error("gift billing pause failed", err instanceof Error ? err.message : err);
    throw new GiftError(502, "billing_pause_failed", "We couldn't pause your paid plan, so your gift wasn't used. Please try again in a few minutes.");
  }
  const { error } = await db.from("gifts").update({ billing_deferral: "applied", paid_through: until, recipient_email: null }).eq("id", gift.giftId).eq("billing_deferral", "pending");
  if (error) throw new Error(`record gift billing pause: ${error.message}`);
  return until;
}

// ---------------------------------------------------------------------------
// Complimentary memberships: what the winner sees
// ---------------------------------------------------------------------------

export interface ComplimentaryLanding {
  months: number;
  occasion: string | null;
  sponsorName: string;
  sponsorIsReadli: boolean;
  eventName: string | null;
  recipientName: string | null;
  message: string | null;
  claimBy: string | null;
  status: "ready" | "redeemed" | "unavailable";
}

/** A complimentary membership's page, or null when the code isn't one (a paid gift opens at /gift/open). */
export async function complimentaryForCode(db: SupabaseClient, code: string, now = new Date()): Promise<ComplimentaryLanding | null> {
  const normalized = normalizeGiftCode(code);
  if (!normalized) return null;
  const { data, error } = await db
    .from("gifts")
    .select("plan_id, status, recipient_name, giver_display_name, event_name, message, complimentary_for, claim_by, sent_at, redeemed_at, batch_id")
    .eq("code_hash", hashGiftCode(normalized))
    .limit(1);
  if (error) throw new Error(`read gift: ${error.message}`);
  const g = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!g || !g.complimentary_for) return null;
  const plan = giftPlan(g.plan_id as string);
  const claimBy = (g.claim_by as string | null) ?? (g.sent_at ? new Date(new Date(g.sent_at as string).getTime() + UNCLAIMED_MS).toISOString() : null);
  const status =
    g.redeemed_at || g.status === "active" || g.status === "ended"
      ? "redeemed"
      : g.status === "sent" && !(claimBy && now.getTime() > new Date(claimBy).getTime())
        ? "ready"
        : "unavailable";
  const sponsorName = g.giver_display_name as string;
  return {
    months: plan?.months ?? 12,
    occasion: (g.complimentary_for as string | null) ?? null,
    sponsorName,
    // Memberships issued before batches named the organization they were for, never Readli.
    sponsorIsReadli: Boolean(g.batch_id) && sponsorName === "Readli",
    eventName: (g.event_name as string | null) ?? null,
    recipientName: (g.recipient_name as string | null) ?? null,
    message: (g.message as string | null) ?? null,
    claimBy,
    status,
  };
}

export type ViewerPlan = "none" | "subscription" | "subscription_ending" | "membership";

/** What the signed-in grown-up already has, so the claim page can explain how the gift fits. */
export async function viewerPlan(db: SupabaseClient, userId: string, now = new Date()): Promise<{ hasFamily: boolean; plan: ViewerPlan; subscriptionRef: string | null }> {
  const { data: homes, error } = await db.from("household_members").select("household_id").eq("user_id", userId).eq("role", "guardian").is("removed_at", null).limit(1);
  if (error) throw new Error(`read family: ${error.message}`);
  const home = (homes ?? [])[0]?.household_id as string | undefined;
  if (!home) return { hasFamily: false, plan: "none", subscriptionRef: null };
  const { data: ents, error: eErr } = await db.from("household_entitlements").select("source, status, starts_at, ends_at, provider_subscription_ref").eq("household_id", home).eq("status", "active");
  if (eErr) throw new Error(`read plan: ${eErr.message}`);
  const at = now.toISOString();
  const live = ((ents ?? []) as Record<string, unknown>[]).filter((e) => (e.starts_at as string) <= at && (e.ends_at === null || (e.ends_at as string) > at));
  const sub = live.find((e) => e.source === "subscription");
  if (sub) return { hasFamily: true, plan: sub.ends_at === null ? "subscription" : "subscription_ending", subscriptionRef: (sub.provider_subscription_ref as string | null) ?? null };
  if (live.some((e) => e.source === "gift" || e.source === "donated")) return { hasFamily: true, plan: "membership", subscriptionRef: null };
  return { hasFamily: true, plan: "none", subscriptionRef: null };
}

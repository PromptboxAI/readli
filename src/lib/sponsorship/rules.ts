import { addMonths, cycleStart } from "@/lib/narration/credits";

/**
 * Grandparent-sponsored Readli Family (Kevin, 2026-10-26). Pure rules: what a sponsor can buy, when they
 * are charged, when access starts and ends, how the credits split, and what removing a family means.
 * The server (server.ts) applies them; the screens use them to show exact dates before anyone confirms.
 *
 * awaiting_payment → scheduled (paid, delivery ahead) → active → past_due / canceling → ended
 * A paid gift canceled before delivery is refunded in full and becomes refunded.
 */
export type SponsorPlan = "monthly" | "annual";
export type SponsorshipStatus = "awaiting_payment" | "scheduled" | "active" | "past_due" | "canceling" | "ended" | "refunded";
export type SeatStatus = "invited" | "active" | "removal_scheduled" | "removed" | "left" | "converted" | "canceled";

export const SPONSORED = {
  monthlyCents: 1999,
  annualCents: 17999,
  households: 2,
  monthlyCredits: 40,
  startingShare: 20,
  creditStep: 5,
  minShare: 5,
  /** A freed place can go to another family at most this often in any 12 months. */
  placeChangesPerYear: 2,
  /** Furthest ahead a delivery can be scheduled. */
  maxDeliveryDays: 120,
  /** A family invitation stays open this long after it's sent. */
  invitationDays: 60,
  /** Delivered at this local hour on the chosen day. */
  deliveryHour: 7,
  /** Year-end notices to the sponsor, and ending notices to the families. */
  sponsorNoticeDays: [30, 7],
  familyNoticeDays: [14, 3],
} as const;

export const LIVE_SEATS: SeatStatus[] = ["invited", "active", "removal_scheduled"];

export function priceCents(plan: SponsorPlan): number {
  return plan === "annual" ? SPONSORED.annualCents : SPONSORED.monthlyCents;
}

const DAY = 86_400_000;
const NAME = 120;
const MESSAGE = 300;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Recipient {
  name: string;
  email: string;
  /** The sponsor agreed to share her own voice with this family. Each family is its own choice. */
  shareVoice: boolean;
}

export interface GiveRequest {
  plan: SponsorPlan;
  deliverAt: Date;
  giverName: string;
  message: string;
  recipients: Recipient[];
  /** True when at least one family gets the sponsor's voice; the consent receipt is recorded then. */
  sharesVoice: boolean;
}

export class SponsorshipError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** The UTC moment that is `hour`:00 on `day` (YYYY-MM-DD) in `timeZone`. */
export function zonedTime(day: string, timeZone: string, hour: number): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour);
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
  // The zone's offset at that moment, then once more in case the first guess crossed a clock change.
  const offset = (t: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)) - t;
  };
  const first = guess - offset(guess);
  return new Date(guess - offset(first));
}

/**
 * Checks what the sponsor asked for. deliverOn is "now" or a day (YYYY-MM-DD) in the sponsor's time
 * zone; the gift arrives at 7am there. Each family's voice share needs the sponsor's consent.
 */
export function giveRequest(input: Record<string, unknown>, now = new Date()): GiveRequest {
  const no = (code: string, message: string) => new SponsorshipError(400, code, message);
  const plan = input.plan;
  if (plan !== "monthly" && plan !== "annual") throw no("bad_plan", "Choose a year or monthly.");

  let deliverAt: Date;
  if (input.deliverOn === "now" || input.deliverOn === undefined) deliverAt = now;
  else {
    const at = zonedTime(String(input.deliverOn), typeof input.timeZone === "string" ? input.timeZone : "UTC", SPONSORED.deliveryHour);
    if (!at) throw no("bad_date", "Choose a delivery date.");
    // A date that is today but already past 7am arrives right away.
    deliverAt = at.getTime() < now.getTime() ? now : at;
    if (now.getTime() - at.getTime() > DAY) throw no("bad_date", "Choose today or a later date.");
    if (at.getTime() - now.getTime() > SPONSORED.maxDeliveryDays * DAY) throw no("bad_date", `Choose a date within ${SPONSORED.maxDeliveryDays} days.`);
  }

  const giverName = String(input.giverName ?? "").trim();
  if (!giverName || giverName.length > NAME) throw no("bad_name", "Add how the families know you, like Grandma Ruth.");
  const message = String(input.message ?? "").trim();
  if (message.length > MESSAGE) throw no("bad_message", `Keep the note under ${MESSAGE} characters.`);

  const list = Array.isArray(input.recipients) ? input.recipients : [];
  if (list.length < 1 || list.length > SPONSORED.households) throw no("bad_recipients", "Add one or two families.");
  const recipients = list.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    const email = String(o.email ?? "").trim().toLowerCase();
    if (!name || name.length > NAME) throw no("bad_recipient_name", "Add each family's name.");
    if (!EMAIL.test(email) || email.length > 254) throw no("bad_email", "Check the email addresses.");
    return { name, email, shareVoice: o.shareVoice === true };
  });
  if (new Set(recipients.map((r) => r.email)).size !== recipients.length) throw no("duplicate_email", "Each family needs its own email address.");
  const sharesVoice = recipients.some((r) => r.shareVoice);
  if (sharesVoice && input.voiceConsent !== true) throw no("consent_required", "Please agree to share your voice with the families you chose.");
  return { plan, deliverAt, giverName, message, recipients, sharesVoice };
}

export interface ChargeSchedule {
  chargedTodayCents: number;
  /** Paid access starts when the gift arrives, not when it's bought. */
  accessStarts: Date;
  /** First moment without access, unless the sponsor renews (monthly renews on its own). */
  paidThrough: Date;
  /** The last full day of paid access, as the screens print it. */
  lastDay: Date;
  /** Monthly: the first renewal, one month after delivery. The year never renews on its own. */
  nextChargeAt: Date | null;
}

export function chargeSchedule(plan: SponsorPlan, deliverAt: Date): ChargeSchedule {
  const paidThrough = new Date(addMonths(deliverAt.toISOString(), plan === "annual" ? 12 : 1));
  return {
    chargedTodayCents: priceCents(plan),
    accessStarts: deliverAt,
    paidThrough,
    lastDay: new Date(paidThrough.getTime() - DAY),
    nextChargeAt: plan === "monthly" ? paidThrough : null,
  };
}

/** The gift month containing `at`, counted from the day the gift arrived. */
export function giftMonth(startsAt: Date, at: Date): { start: Date; end: Date } {
  const start = cycleStart(startsAt.toISOString(), at.toISOString());
  return { start: new Date(start), end: new Date(addMonths(start, 1)) };
}

export interface SponsorshipFacts {
  plan: SponsorPlan;
  status: SponsorshipStatus;
  startsAt: Date | null;
  paidThrough: Date | null;
  endsAt: Date | null;
  deliveredAt: Date | null;
}

/**
 * When removing a family takes effect: the end of the current gift month, or sooner if the whole gift
 * ends first. An invited family that hasn't joined is withdrawn straight away.
 */
export function removalDate(sp: SponsorshipFacts, seat: { status: SeatStatus }, now = new Date()): Date {
  if (seat.status === "invited" || !sp.startsAt) return now;
  const monthEnd = giftMonth(sp.startsAt, now).end;
  const giftEnd = sp.endsAt ?? (sp.plan === "annual" || sp.status === "canceling" ? sp.paidThrough : null);
  return giftEnd && giftEnd < monthEnd ? giftEnd : monthEnd;
}

/**
 * A freed place can go to another family at most twice in any 12 months. `offered` are the times
 * places were offered again after delivery (the first two families don't count).
 */
export function canOfferPlace(offered: Date[], now = new Date()): boolean {
  const since = now.getTime() - 365 * DAY;
  return offered.filter((d) => d.getTime() > since).length < SPONSORED.placeChangesPerYear;
}

/**
 * A new credit split. Steps of 5, at least 5 for each family, never more than the gift's 40 in all,
 * and exactly 40 when both places are filled. It takes effect from the next gift month.
 */
export function creditSplit(shares: Record<number, unknown>, liveSeats: number[]): Record<number, number> {
  const no = (message: string) => new SponsorshipError(400, "bad_split", message);
  const out: Record<number, number> = {};
  for (const seat of liveSeats) {
    const n = Number(shares[seat]);
    if (!Number.isInteger(n) || n % SPONSORED.creditStep !== 0) throw no(`Use steps of ${SPONSORED.creditStep} credits.`);
    if (n < SPONSORED.minShare) throw no(`Each family keeps at least ${SPONSORED.minShare} credits.`);
    out[seat] = n;
  }
  const total = Object.values(out).reduce((a, b) => a + b, 0);
  if (total > SPONSORED.monthlyCredits) throw no(`Your gift has ${SPONSORED.monthlyCredits} credits a month to share.`);
  if (liveSeats.length === SPONSORED.households && total !== SPONSORED.monthlyCredits) throw no(`Share all ${SPONSORED.monthlyCredits} credits between your two families.`);
  return out;
}

export type CancelOutcome =
  /** Not delivered yet: full refund, the waiting subscription is canceled, no invitation goes out. */
  | { kind: "refund_before_delivery" }
  /** Monthly after delivery: no more charges; the paid month runs out. */
  | { kind: "stop_renewal"; lastDay: Date; endsAt: Date }
  /** The year never renews, so there is nothing to stop. Refunds after delivery go through support. */
  | { kind: "year_does_not_renew"; endsAt: Date }
  | { kind: "nothing_to_cancel" };

export function cancelOutcome(sp: SponsorshipFacts): CancelOutcome {
  if (sp.status === "scheduled" && !sp.deliveredAt) return { kind: "refund_before_delivery" };
  if (!["active", "past_due"].includes(sp.status) || !sp.paidThrough) return { kind: "nothing_to_cancel" };
  if (sp.plan === "annual") return { kind: "year_does_not_renew", endsAt: sp.paidThrough };
  return { kind: "stop_renewal", endsAt: sp.paidThrough, lastDay: new Date(sp.paidThrough.getTime() - DAY) };
}

/** The moment a family's gift access ends, if one is known (null: it carries on while the sponsor pays). */
export function accessEnd(sp: SponsorshipFacts, seat: { accessUntil: Date | null }): Date | null {
  const cap = (d: Date | null) => (seat.accessUntil && (!d || seat.accessUntil < d) ? seat.accessUntil : d);
  if (sp.status === "ended" || sp.status === "refunded") return cap(sp.endsAt ?? new Date(0));
  if (sp.plan === "annual" || sp.status === "canceling") return cap(sp.endsAt ?? sp.paidThrough);
  return seat.accessUntil;
}

/**
 * When a family's own plan should start charging. Starting one while the gift still has a known end
 * waits for that end, so nobody pays twice; a gift with no end yet covers them already.
 */
export function ownPlanStart(giftEnds: Date | null, now = new Date()): { ok: true; startsAt: Date } | { ok: false } {
  if (!giftEnds) return { ok: false };
  return { ok: true, startsAt: giftEnds > now ? giftEnds : now };
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export const shortDate = (d: Date) => DATE_FMT.format(d);
export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** The plan-choice and checkout lines from the approved copy, with real dates. */
export function chargeCopy(plan: SponsorPlan, deliverAt: Date): { choice: string; summary: string; renewal: string } {
  const s = chargeSchedule(plan, deliverAt);
  if (plan === "annual") {
    return {
      choice: `A whole year of bedtime stories · ${dollars(s.chargedTodayCents)}, paid today · Starts on the day it arrives · Doesn't renew unless you choose to`,
      summary: `Charged today: ${dollars(s.chargedTodayCents)} · Covers ${shortDate(s.accessStarts)} to ${shortDate(s.lastDay)} · No automatic renewal`,
      renewal: "No automatic renewal.",
    };
  }
  const next = shortDate(s.nextChargeAt!);
  return {
    choice: `Monthly · ${dollars(s.chargedTodayCents)} · First month paid today · Then ${dollars(s.chargedTodayCents)} each month from ${next} until you cancel`,
    summary: `Charged today: ${dollars(s.chargedTodayCents)} · Covers ${shortDate(s.accessStarts)} to ${shortDate(s.lastDay)}`,
    renewal: `Then ${dollars(s.chargedTodayCents)} on ${next} and every month after, until you cancel.`,
  };
}

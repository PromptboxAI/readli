import type { GiftPlan } from "./plans";

/**
 * Gift lifecycle (pure). The server applies these rules; the UI uses them to explain what will happen.
 *
 * awaiting_payment → scheduled (paid, delivery date ahead) → sent → active → ended
 * Unredeemed gifts can be cancelled; sent gifts that nobody redeems lapse after UNCLAIMED_DAYS.
 */
export type GiftStatus = "awaiting_payment" | "scheduled" | "sent" | "active" | "ended" | "cancelled" | "unclaimed";

export interface Gift {
  id: string;
  plan: GiftPlan;
  status: GiftStatus;
  giverName: string;
  recipientName: string;
  recipientEmail: string;
  message: string;
  deliverOn: Date;
  sentAt: Date | null;
  redeemedAt: Date | null;
  /** End of the paid period the recipient can use. */
  paidThrough: Date | null;
  /** Recurring only: set when the giver stops renewals; access runs to paidThrough. */
  renewalsStopped: boolean;
}

/** A sent gift link stays redeemable this long. */
export const UNCLAIMED_DAYS = 365;
/** How far ahead renewal and ending notices go out. */
export const NOTICE_DAYS = { giverBeforeRenewal: 7, recipientBeforeEnd: [14, 3], giverBeforeEnd: 14 } as const;

/**
 * What the giver can ever see about a gift. Everything else about the recipient's household
 * (family circle, child profiles, voices, listening) stays private to the recipient.
 */
export const GIVER_VISIBLE_FIELDS = ["status", "recipientName", "deliverOn", "redeemedAt", "paidThrough", "plan"] as const;

const DAY = 86_400_000;

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY);
}

/** Effective status at a moment: lapses unredeemed gifts and finishes ended ones. */
export function statusAt(gift: Gift, now: Date): GiftStatus {
  if (gift.status === "sent" && gift.sentAt && now.getTime() > addDays(gift.sentAt, UNCLAIMED_DAYS).getTime()) return "unclaimed";
  if (gift.status === "active" && gift.paidThrough && now.getTime() >= gift.paidThrough.getTime()) {
    if (gift.plan.kind === "prepaid" || gift.renewalsStopped) return "ended";
  }
  return gift.status;
}

export type RedeemResult =
  | { ok: true; gift: Gift; startsOn: Date }
  | { ok: false; reason: "not_redeemable" | "unclaimed" | "already_redeemed" | "cancelled" };

/**
 * Recipient accepts the gift into their own household. If they already pay for Readli,
 * prepaid months start when their current paid period ends, so nothing is wasted.
 */
export function redeemGift(gift: Gift, now: Date, existingPaidThrough: Date | null = null): RedeemResult {
  const status = statusAt(gift, now);
  if (status === "cancelled") return { ok: false, reason: "cancelled" };
  if (status === "unclaimed") return { ok: false, reason: "unclaimed" };
  if (status === "active" || status === "ended") return { ok: false, reason: "already_redeemed" };
  if (status !== "sent") return { ok: false, reason: "not_redeemable" };

  const startsOn = existingPaidThrough && existingPaidThrough.getTime() > now.getTime() ? existingPaidThrough : now;
  const months = gift.plan.kind === "prepaid" ? (gift.plan.months ?? 1) : 1;
  return {
    ok: true,
    startsOn,
    gift: { ...gift, status: "active", redeemedAt: now, paidThrough: addMonths(startsOn, months) },
  };
}

export type CancelResult =
  | { ok: true; gift: Gift; refund: "full" | "none"; accessUntil: Date | null; summary: string }
  | { ok: false; reason: "already_redeemed" | "already_finished"; summary: string };

/**
 * Giver cancels.
 * - Not yet redeemed (any plan): cancelled now, full refund, the link stops working.
 * - Redeemed prepaid: it's theirs now; the giver can't take it back.
 * - Redeemed sponsorship: renewals stop; the recipient keeps access to the end of the paid month.
 */
export function cancelGift(gift: Gift, now: Date): CancelResult {
  const status = statusAt(gift, now);
  if (status === "awaiting_payment" || status === "scheduled" || status === "sent") {
    return {
      ok: true,
      gift: { ...gift, status: "cancelled" },
      refund: status === "awaiting_payment" ? "none" : "full",
      accessUntil: null,
      summary: `Cancelled. ${gift.recipientName}'s gift link no longer works${status === "awaiting_payment" ? "" : " and you'll get a full refund"}.`,
    };
  }
  if (status === "active" && gift.plan.kind === "recurring") {
    if (gift.renewalsStopped) {
      return { ok: false, reason: "already_finished", summary: "Renewals are already stopped." };
    }
    return {
      ok: true,
      gift: { ...gift, renewalsStopped: true },
      refund: "none",
      accessUntil: gift.paidThrough,
      summary: `Renewals stopped. ${gift.recipientName} keeps Readli until the end of the month you've paid for, and we'll let them know.`,
    };
  }
  if (status === "active") {
    return {
      ok: false,
      reason: "already_redeemed",
      summary: `${gift.recipientName} has already opened this gift, so it runs to the end of its term.`,
    };
  }
  return { ok: false, reason: "already_finished", summary: "This gift has already finished." };
}

export interface Notice {
  audience: "giver" | "recipient";
  kind: "renewal_upcoming" | "gift_ending" | "sponsorship_ending";
  sendAt: Date;
}

/** Renewal and ending notices for an active gift. Recipients never see payment details. */
export function renewalNotices(gift: Gift): Notice[] {
  if (gift.status !== "active" || !gift.paidThrough) return [];
  const end = gift.paidThrough;
  if (gift.plan.kind === "recurring" && !gift.renewalsStopped) {
    return [{ audience: "giver", kind: "renewal_upcoming", sendAt: addDays(end, -NOTICE_DAYS.giverBeforeRenewal) }];
  }
  const recipient: Notice[] = NOTICE_DAYS.recipientBeforeEnd.map((d) => ({
    audience: "recipient",
    kind: gift.plan.kind === "recurring" ? "sponsorship_ending" : "gift_ending",
    sendAt: addDays(end, -d),
  }));
  return [...recipient, { audience: "giver", kind: "gift_ending", sendAt: addDays(end, -NOTICE_DAYS.giverBeforeEnd) }];
}

export const STATUS_LABEL: Record<GiftStatus, string> = {
  awaiting_payment: "Not paid yet",
  scheduled: "Scheduled",
  sent: "Waiting to be opened",
  active: "Being enjoyed",
  ended: "Finished",
  cancelled: "Cancelled",
  unclaimed: "Never opened",
};

/**
 * What a redeemed gift grants the recipient's household, in the family engine's terms
 * (grantEntitlement in src/lib/family/service.ts): the same Readli Family entitlements as a paid
 * plan, sourced "gift". A sponsorship grants one month at a time as each payment succeeds.
 */
export function entitlementGrantFromGift(gift: Gift): { source: "gift"; months: number } | null {
  if (gift.status !== "active") return null;
  return { source: "gift", months: gift.plan.kind === "prepaid" ? (gift.plan.months ?? 1) : 1 };
}

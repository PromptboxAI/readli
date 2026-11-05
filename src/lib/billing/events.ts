/**
 * Turns verified Stripe webhook events into Readli changes. Pure: the webhook route applies the
 * result. Readli Family comes from the subscription events (they carry the household in metadata, set
 * at checkout); checkout.session.completed links the household to its Stripe customer.
 */

export interface SubscriptionChange {
  kind: "subscription";
  householdId: string;
  subscriptionRef: string;
  customerRef: string | null;
  /** active covers Stripe's active, trialing and past_due (Stripe is still retrying the card). */
  status: "active" | "canceled";
  extraNarratorSlots: number;
  startsAt: string;
  endsAt: string | null;
}

export interface CustomerLink {
  kind: "customer";
  householdId: string;
  customerRef: string;
}

/** A paid credit pack. Credits are the whole credits the parent paid for, recorded at checkout. */
export interface CreditPackPurchase {
  kind: "credit_pack";
  householdId: string;
  customerRef: string | null;
  adultId: string | null;
  packId: string;
  credits: number;
  paymentRef: string;
}

export type BillingChange = SubscriptionChange | CustomerLink | CreditPackPurchase | { kind: "ignore"; reason: string };

interface StripeObject {
  [key: string]: unknown;
}

const iso = (seconds: unknown): string | null => (typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
/** A family's own plan bought while a gift is ending starts when the gift ends, so the two never overlap. */
const later = (a: string, b: string | null): string => (b && !Number.isNaN(Date.parse(b)) && Date.parse(b) > Date.parse(a) ? new Date(b).toISOString() : a);
const ref = (v: unknown): string | null => str(v) ?? str((v as StripeObject | null)?.id);

function extraSlots(sub: StripeObject): number {
  const items = ((sub.items as StripeObject | undefined)?.data as StripeObject[] | undefined) ?? [];
  return items
    .filter((i) => str((i.price as StripeObject | undefined)?.lookup_key)?.startsWith("readli_extra_slot_"))
    .reduce((n, i) => n + (typeof i.quantity === "number" ? i.quantity : 0), 0);
}

export function billingChange(event: { type: string; data?: { object?: StripeObject } }): BillingChange {
  const obj = event.data?.object;
  if (!obj) return { kind: "ignore", reason: "no object" };
  const householdId = str((obj.metadata as StripeObject | undefined)?.household_id);
  // Sponsorships have their own branch (src/lib/sponsorship/events.ts) and never touch a household plan here.
  if ((obj.metadata as StripeObject | undefined)?.readli_kind === "sponsorship") return { kind: "ignore", reason: "sponsorship" };

  if (event.type === "checkout.session.completed") {
    const customerRef = ref(obj.customer);
    const household = householdId ?? str(obj.client_reference_id);
    const meta = (obj.metadata as StripeObject | undefined) ?? {};
    const item = str(meta.item) ?? "";
    if (obj.mode === "payment" && item.startsWith("credit_pack:")) {
      const credits = Number(meta.credits);
      const paymentRef = ref(obj.payment_intent) ?? str(obj.id);
      if (obj.payment_status !== "paid") return { kind: "ignore", reason: "credit pack not paid yet" };
      if (!household || !paymentRef || !Number.isInteger(credits) || credits <= 0) return { kind: "ignore", reason: "credit pack without household or credits" };
      return { kind: "credit_pack", householdId: household, customerRef, adultId: str(meta.adult_id), packId: item.slice("credit_pack:".length), credits, paymentRef };
    }
    if (!household || !customerRef) return { kind: "ignore", reason: "checkout without household or customer" };
    return { kind: "customer", householdId: household, customerRef };
  }

  if (event.type.startsWith("customer.subscription.")) {
    const subscriptionRef = str(obj.id);
    if (!householdId || !subscriptionRef) return { kind: "ignore", reason: "subscription without household" };
    const live = ["active", "trialing", "past_due"].includes(String(obj.status)) && event.type !== "customer.subscription.deleted";
    const periodEnd = iso(obj.current_period_end) ?? iso(((obj.items as StripeObject | undefined)?.data as StripeObject[] | undefined)?.[0]?.current_period_end);
    const endsAt = live ? (obj.cancel_at_period_end ? periodEnd : iso(obj.cancel_at)) : (iso(obj.ended_at) ?? new Date().toISOString());
    return {
      kind: "subscription",
      householdId,
      subscriptionRef,
      customerRef: ref(obj.customer),
      status: live ? "active" : "canceled",
      extraNarratorSlots: extraSlots(obj),
      startsAt: later(iso(obj.start_date) ?? new Date().toISOString(), str((obj.metadata as StripeObject | undefined)?.starts_after)),
      endsAt,
    };
  }

  return { kind: "ignore", reason: `unhandled ${event.type}` };
}

/**
 * The invite funnel step a subscription event marks for the household's storyteller invitations: a
 * trial starting, or the first paid period. The invitation is the one named at checkout when there is
 * one; otherwise the household's accepted invitations are credited.
 */
export function invitationBilling(event: { type: string; data?: { object?: StripeObject } }): { householdId: string; invitationId: string | null; kind: "trial" | "paid" } | null {
  const obj = event.data?.object;
  if (!obj || !event.type.startsWith("customer.subscription.") || event.type === "customer.subscription.deleted") return null;
  const meta = (obj.metadata as StripeObject | undefined) ?? {};
  const householdId = str(meta.household_id);
  if (!householdId) return null;
  const kind = obj.status === "trialing" ? "trial" : obj.status === "active" ? "paid" : null;
  return kind ? { householdId, invitationId: str(meta.invitation_id), kind } : null;
}

const CANCEL_REASONS = ["cancellation_requested", "payment_failed", "payment_disputed"] as const;
const CANCEL_FEEDBACK = ["customer_service", "low_quality", "missing_features", "other", "switched_service", "too_complex", "too_expensive", "unused"] as const;
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => (list.includes(v as T) ? (v as T) : null);

export type CancellationChange =
  | {
      kind: "canceled";
      householdId: string;
      subscriptionRef: string;
      reason: (typeof CANCEL_REASONS)[number] | null;
      feedback: (typeof CANCEL_FEEDBACK)[number] | null;
      comment: string | null;
      requestedAt: string;
      endsAt: string | null;
    }
  | { kind: "withdrawn"; subscriptionRef: string };

/**
 * Why a family plan ended, for the admin growth report: Stripe's cancellation_details (asked, failed
 * payment or dispute, plus the customer portal's cancel survey) once a cancel is scheduled or done,
 * or "withdrawn" when a scheduled cancel is turned off again. Reporting only.
 */
export function cancellationChange(event: { type: string; created?: number; data?: { object?: StripeObject } }): CancellationChange | null {
  const obj = event.data?.object;
  if (!obj || !event.type.startsWith("customer.subscription.")) return null;
  const meta = (obj.metadata as StripeObject | undefined) ?? {};
  if (meta.readli_kind === "sponsorship") return null;
  const householdId = str(meta.household_id);
  const subscriptionRef = str(obj.id);
  if (!householdId || !subscriptionRef) return null;
  const ended = event.type === "customer.subscription.deleted" || obj.status === "canceled";
  const scheduled = obj.cancel_at_period_end === true || typeof obj.cancel_at === "number";
  if (!ended && !scheduled) return ["active", "trialing", "past_due"].includes(String(obj.status)) ? { kind: "withdrawn", subscriptionRef } : null;
  const details = (obj.cancellation_details as StripeObject | undefined) ?? {};
  const comment = str(details.comment);
  const periodEnd = iso(obj.current_period_end) ?? iso(((obj.items as StripeObject | undefined)?.data as StripeObject[] | undefined)?.[0]?.current_period_end);
  return {
    kind: "canceled",
    householdId,
    subscriptionRef,
    reason: oneOf(CANCEL_REASONS, details.reason),
    feedback: oneOf(CANCEL_FEEDBACK, details.feedback),
    comment: comment ? comment.trim().slice(0, 1000) || null : null,
    requestedAt: iso(obj.canceled_at) ?? iso(event.created) ?? new Date().toISOString(),
    endsAt: ended ? (iso(obj.ended_at) ?? iso(event.created)) : (iso(obj.cancel_at) ?? periodEnd),
  };
}

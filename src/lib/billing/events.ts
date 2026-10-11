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
  /** In Stripe's free trial: the plan is a Readli trial (trial credits, not the monthly allowance) until it converts. */
  trial: boolean;
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
    const trial = live && obj.status === "trialing";
    const trialEnd = iso(obj.trial_end);
    const cancelEnd = obj.cancel_at_period_end ? periodEnd : iso(obj.cancel_at);
    const endsAt = !live ? (iso(obj.ended_at) ?? new Date().toISOString()) : trial ? (cancelEnd ?? trialEnd) : cancelEnd;
    // Once a trial converts, paid months count from the trial's end, so the monthly credits line up with billing.
    const startsAt = trial ? (iso(obj.trial_start) ?? iso(obj.start_date)) : (trialEnd ?? iso(obj.start_date));
    return {
      kind: "subscription",
      householdId,
      subscriptionRef,
      customerRef: ref(obj.customer),
      status: live ? "active" : "canceled",
      trial,
      extraNarratorSlots: extraSlots(obj),
      startsAt: startsAt ?? new Date().toISOString(),
      endsAt,
    };
  }

  return { kind: "ignore", reason: `unhandled ${event.type}` };
}

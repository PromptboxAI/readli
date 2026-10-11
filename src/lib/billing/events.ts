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
  /** Readli Family, or the Family Archive when the subscription is for the Archive price. */
  tier: "family" | "archive";
  /**
   * When the subscription's free trial ends, if it has one. One plan row covers the trial and the paid
   * plan it turns into: until this date the household gets the trial credits, then the monthly ones.
   */
  trialEndsAt: string | null;
  extraNarratorSlots: number;
  /** How often the plan item bills: monthly or yearly. */
  billingInterval: "month" | "year" | null;
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

function itemsOf(sub: StripeObject): StripeObject[] {
  return ((sub.items as StripeObject | undefined)?.data as StripeObject[] | undefined) ?? [];
}

/** A subscription whose plan item is the Archive price (lookup key readli_archive_monthly_<cents>). */
function tierOf(sub: StripeObject): "family" | "archive" {
  return itemsOf(sub).some((i) => str((i.price as StripeObject | undefined)?.lookup_key)?.startsWith("readli_archive_monthly_")) ? "archive" : "family";
}

const PLAN_PREFIXES = ["readli_family_monthly_", "readli_family_annual_", "readli_archive_monthly_"];

function billingInterval(sub: StripeObject): "month" | "year" | null {
  const plan = itemsOf(sub).find((i) => PLAN_PREFIXES.some((p) => str((i.price as StripeObject | undefined)?.lookup_key)?.startsWith(p)));
  const interval = str(((plan?.price as StripeObject | undefined)?.recurring as StripeObject | undefined)?.interval);
  return interval === "month" || interval === "year" ? interval : null;
}

function extraSlots(sub: StripeObject): number {
  const items = itemsOf(sub);
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
    // A trial doesn't end the plan: Stripe either turns it into Readli Family on the card taken at
    // checkout or cancels the subscription, which arrives as its own event.
    const endsAt = live ? (obj.cancel_at_period_end ? periodEnd : iso(obj.cancel_at)) : (iso(obj.ended_at) ?? new Date().toISOString());
    return {
      kind: "subscription",
      householdId,
      subscriptionRef,
      customerRef: ref(obj.customer),
      status: live ? "active" : "canceled",
      tier: tierOf(obj),
      trialEndsAt: iso(obj.trial_end),
      // The Archive has no extra narrator slots.
      extraNarratorSlots: tierOf(obj) === "archive" ? 0 : extraSlots(obj),
      billingInterval: billingInterval(obj),
      startsAt: iso(obj.start_date) ?? new Date().toISOString(),
      endsAt,
    };
  }

  return { kind: "ignore", reason: `unhandled ${event.type}` };
}

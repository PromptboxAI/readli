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

export type BillingChange = SubscriptionChange | CustomerLink | { kind: "ignore"; reason: string };

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
      startsAt: iso(obj.start_date) ?? new Date().toISOString(),
      endsAt,
    };
  }

  return { kind: "ignore", reason: `unhandled ${event.type}` };
}

/**
 * Stripe events for sponsorships (pure). Every Stripe object a sponsorship creates carries
 * readli_kind=sponsorship and the sponsorship id, so these never mix with household Family plans,
 * credit packs or prepaid gifts; billingChange ignores them.
 */
type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const iso = (s: unknown): string | null => (num(s) === null ? null : new Date((s as number) * 1000).toISOString());
const ref = (v: unknown): string | null => str(v) ?? str(o(v).id);

export const SPONSORSHIP_KIND = "sponsorship";

export type SponsorshipChange =
  /**
   * The first payment went through: the gift is scheduled. A monthly gift's checkout also made its
   * subscription (subscriptionRef), and its first payment is found through the checkout's invoice.
   */
  | { kind: "paid"; sponsorshipId: string; customerRef: string | null; paymentRef: string | null; subscriptionRef?: string; invoiceRef?: string }
  /** The monthly subscription changed: renewal dates, failing card, cancel at period end, or ended. */
  | { kind: "subscription"; sponsorshipId: string; subscriptionRef: string; state: "live" | "past_due" | "canceling" | "ended"; paidThrough: string | null; endsAt: string | null }
  /** A renewal was paid: access runs to the end of that period. */
  | { kind: "renewed"; sponsorshipId: string; paidThrough: string }
  /** A renewal charge failed; Stripe keeps retrying for about two weeks. Only the sponsor hears. */
  | { kind: "renewal_failed"; sponsorshipId: string }
  | { kind: "refunded"; sponsorshipId: string | null; paymentRef: string | null; full: boolean }
  /** A chargeback: coverage ends at once for both families. */
  | { kind: "disputed"; paymentRef: string }
  | { kind: "ignore"; reason: string };

/** Is this event about a sponsorship? Checked before the household billing path sees it. */
export function isSponsorshipEvent(event: { type: string; data?: { object?: Obj } }): boolean {
  const obj = o(event.data?.object);
  if (str(o(obj.metadata).readli_kind) === SPONSORSHIP_KIND) return true;
  if (event.type.startsWith("invoice.")) return str(subscriptionMeta(obj).readli_kind) === SPONSORSHIP_KIND;
  return false;
}

function subscriptionMeta(invoice: Obj): Obj {
  for (const m of [o(o(invoice.subscription_details).metadata), o(o(o(invoice.parent).subscription_details).metadata)]) {
    if (str(m.readli_kind)) return m;
  }
  const lines = (o(invoice.lines).data as Obj[] | undefined) ?? [];
  return o(lines.find((l) => str(o(l.metadata).readli_kind))?.metadata);
}

export function sponsorshipChange(event: { type: string; data?: { object?: Obj } }): SponsorshipChange {
  const obj = o(event.data?.object);
  const meta = o(obj.metadata);
  const id = str(meta.sponsorship_id);

  if (event.type === "charge.dispute.created") {
    const paymentRef = ref(obj.payment_intent);
    return paymentRef ? { kind: "disputed", paymentRef } : { kind: "ignore", reason: "dispute without payment" };
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (meta.readli_kind !== SPONSORSHIP_KIND || !id) return { kind: "ignore", reason: "not a sponsorship" };
    if (obj.payment_status !== "paid") return { kind: "ignore", reason: "sponsorship not paid yet" };
    const paymentRef = ref(obj.payment_intent);
    const invoiceRef = ref(obj.invoice) ?? undefined;
    if (!paymentRef && !invoiceRef) return { kind: "ignore", reason: "sponsorship without payment" };
    return { kind: "paid", sponsorshipId: id, customerRef: ref(obj.customer), paymentRef, subscriptionRef: ref(obj.subscription) ?? undefined, invoiceRef };
  }
  if (event.type.startsWith("customer.subscription.")) {
    const subscriptionRef = str(obj.id);
    if (!id || !subscriptionRef) return { kind: "ignore", reason: "subscription without sponsorship" };
    const periodEnd = iso(obj.current_period_end) ?? iso(o(((o(obj.items).data as Obj[] | undefined) ?? [])[0]).current_period_end);
    const paidThrough = obj.status === "trialing" ? (iso(obj.trial_end) ?? periodEnd) : periodEnd;
    if (event.type === "customer.subscription.deleted" || ["canceled", "incomplete_expired"].includes(String(obj.status))) {
      return { kind: "subscription", sponsorshipId: id, subscriptionRef, state: "ended", paidThrough, endsAt: iso(obj.ended_at) ?? iso(obj.canceled_at) ?? new Date().toISOString() };
    }
    if (["past_due", "unpaid"].includes(String(obj.status))) return { kind: "subscription", sponsorshipId: id, subscriptionRef, state: "past_due", paidThrough, endsAt: null };
    if (obj.cancel_at_period_end || obj.cancel_at) {
      return { kind: "subscription", sponsorshipId: id, subscriptionRef, state: "canceling", paidThrough, endsAt: iso(obj.cancel_at) ?? paidThrough };
    }
    return { kind: "subscription", sponsorshipId: id, subscriptionRef, state: "live", paidThrough, endsAt: null };
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const m = subscriptionMeta(obj);
    const sid = str(m.sponsorship_id);
    if (m.readli_kind !== SPONSORSHIP_KIND || !sid) return { kind: "ignore", reason: "not a sponsorship invoice" };
    if (event.type === "invoice.payment_failed") return { kind: "renewal_failed", sponsorshipId: sid };
    if ((num(obj.amount_paid) ?? 0) <= 0) return { kind: "ignore", reason: "nothing paid" };
    const lines = (o(obj.lines).data as Obj[] | undefined) ?? [];
    const end = lines.map((l) => iso(o(l.period).end)).filter((d): d is string => Boolean(d)).sort().pop();
    return end ? { kind: "renewed", sponsorshipId: sid, paidThrough: end } : { kind: "ignore", reason: "invoice without period" };
  }
  if (event.type === "charge.refunded") {
    const amount = num(obj.amount) ?? 0;
    const refunded = num(obj.amount_refunded) ?? 0;
    return { kind: "refunded", sponsorshipId: id, paymentRef: ref(obj.payment_intent), full: amount > 0 && refunded >= amount };
  }
  return { kind: "ignore", reason: `unhandled ${event.type}` };
}

import type { StripeSubscription } from "./stripe-api";

/**
 * Readli's own plan-change flow for Stripe subscriptions (Kevin, 2026-10-11, decision 5): Readli Family
 * monthly ↔ yearly, and Readli Family ↔ the Family Archive. The billing portal still handles cards,
 * extra slots and cancelling. Readli never changes the household's plan here: it asks Stripe to change
 * the subscription, and the plan changes when Stripe's subscription event arrives at the webhook.
 *
 * - Upgrades (Archive → Family, monthly → yearly) take effect now and are invoiced at once with
 *   proration; with payment_behavior "pending_if_incomplete", a failed payment leaves the
 *   subscription as it was.
 * - Downgrades (Family → Archive, yearly → monthly) take effect now; Stripe credits the unused part
 *   of the period to the customer's balance, which pays future invoices. No cash refund is issued.
 * - Moving to the Archive removes extra storyteller slots (the Archive has none).
 * - Nothing in the family's library, kids profiles or permissions is touched by any of this.
 */
export type PlanTarget = "family_monthly" | "family_annual" | "archive_monthly";

const PREFIX: Record<PlanTarget, string> = {
  family_monthly: "readli_family_monthly_",
  family_annual: "readli_family_annual_",
  archive_monthly: "readli_archive_monthly_",
};
const SLOT_PREFIX = "readli_extra_slot_";

const RANK: Record<PlanTarget, number> = { archive_monthly: 0, family_monthly: 1, family_annual: 2 };

export function currentTarget(sub: StripeSubscription): PlanTarget | null {
  for (const item of sub.items.data) {
    const key = item.price.lookup_key ?? "";
    for (const [target, prefix] of Object.entries(PREFIX) as [PlanTarget, string][]) if (key.startsWith(prefix)) return target;
  }
  return null;
}

export type PlanChangeRefusal = "no_plan_item" | "same_plan" | "not_active" | "in_trial" | "has_slots";

export type PlanChange =
  | { ok: true; from: PlanTarget; to: PlanTarget; upgrade: boolean; params: Record<string, unknown> }
  | { ok: false; reason: PlanChangeRefusal };

export function planChange(sub: StripeSubscription, to: PlanTarget, priceId: string, nowSeconds: number): PlanChange {
  if (!["active", "trialing", "past_due"].includes(sub.status)) return { ok: false, reason: "not_active" };
  const from = currentTarget(sub);
  if (!from) return { ok: false, reason: "no_plan_item" };
  if (from === to) return { ok: false, reason: "same_plan" };
  // A trial already includes Readli Family; changing plan during it would end the trial early.
  if (sub.status === "trialing" && (sub.trial_end ?? 0) > nowSeconds) return { ok: false, reason: "in_trial" };
  const planItem = sub.items.data.find((i) => (i.price.lookup_key ?? "").startsWith(PREFIX[from]))!;
  const slots = sub.items.data.filter((i) => (i.price.lookup_key ?? "").startsWith(SLOT_PREFIX));
  const upgrade = RANK[to] > RANK[from];
  const yearlyChange = (from === "family_annual") !== (to === "family_annual");
  const items: Record<string, unknown>[] = [{ id: planItem.id, price: priceId, quantity: 1 }];
  if (to === "archive_monthly") for (const s of slots) items.push({ id: s.id, deleted: true });
  // Extra slots bill monthly; Stripe can't mix monthly and yearly items in one subscription.
  else if (to === "family_annual" && slots.length) return { ok: false, reason: "has_slots" };
  return {
    ok: true,
    from,
    to,
    upgrade,
    params: {
      items,
      proration_behavior: upgrade ? "always_invoice" : "create_prorations",
      ...(upgrade ? { payment_behavior: "pending_if_incomplete" } : {}),
      ...(yearlyChange ? { billing_cycle_anchor: "now" } : {}),
      // Stripe accepts only item and billing changes alongside pending_if_incomplete.
      ...(upgrade ? {} : { metadata: { ...(sub.metadata ?? {}), last_plan_change: `${from}->${to}` } }),
    },
  };
}

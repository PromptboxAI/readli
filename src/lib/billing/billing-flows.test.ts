// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import { applyBillingChange } from "./apply";
import { billingChange } from "./events";
import { queuePaymentFailed } from "./notify";
import { planChange } from "./plan-change";
import type { StripeSubscription } from "./stripe-api";
import { accountKey, cardKey, emailKey } from "./trial";

/**
 * Kevin's billing scenarios (2026-10-11, decision 5): downgrades, upgrades, failed payments, duplicate
 * and late webhooks, and monthly ↔ yearly changes, from the Stripe event to the household's plan row.
 */
const NOW = 1_791_000_000;
const iso = (s: number) => new Date(s * 1000).toISOString();

function stripeSub(items: [string, string, number?][], over: Partial<StripeSubscription> = {}): StripeSubscription {
  return {
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    metadata: { household_id: "h1" },
    items: { data: items.map(([id, key, quantity]) => ({ id, quantity: quantity ?? 1, price: { id: `price_${key}`, lookup_key: key, recurring: { interval: key.includes("annual") ? "year" : "month" } } })) },
    ...over,
  };
}

const subEvent = (type: string, sub: StripeSubscription, created: number, extra: Record<string, unknown> = {}) => ({
  id: `evt_${created}`,
  type,
  created,
  data: { object: { ...sub, start_date: NOW - 86_400 * 40, current_period_end: NOW + 86_400 * 20, cancel_at_period_end: false, ...extra } as unknown as Record<string, unknown> },
});

async function apply(db: ReturnType<typeof fakeSupabase>["db"], e: ReturnType<typeof subEvent>) {
  await applyBillingChange(db, billingChange(e), false, DEFAULT_PLAN, new Date(e.created * 1000), { eventAt: iso(e.created) });
}

describe("Readli's plan change requests", () => {
  const family = stripeSub([
    ["si_plan", "readli_family_monthly_1999"],
    ["si_slot", "readli_extra_slot_599", 2],
  ]);

  it("downgrades to the Archive now, removing extra slots, with unused time credited", () => {
    const change = planChange(family, "archive_monthly", "price_archive", NOW);
    expect(change).toMatchObject({ ok: true, from: "family_monthly", to: "archive_monthly", upgrade: false });
    expect(change.ok && change.params).toMatchObject({
      items: [{ id: "si_plan", price: "price_archive", quantity: 1 }, { id: "si_slot", deleted: true }],
      proration_behavior: "create_prorations",
    });
    expect(change.ok && change.params).not.toHaveProperty("payment_behavior");
  });

  it("upgrades from the Archive only once payment succeeds", () => {
    const archive = stripeSub([["si_plan", "readli_archive_monthly_699"]]);
    const change = planChange(archive, "family_monthly", "price_family", NOW);
    expect(change.ok && change.params).toMatchObject({ proration_behavior: "always_invoice", payment_behavior: "pending_if_incomplete", items: [{ id: "si_plan", price: "price_family" }] });
    expect(change.ok && change.params).not.toHaveProperty("metadata");
    const yearly = planChange(archive, "family_annual", "price_year", NOW);
    expect(yearly.ok && yearly.params).toMatchObject({ billing_cycle_anchor: "now", proration_behavior: "always_invoice" });
  });

  it("switches monthly ↔ yearly with a new billing date, and refuses yearly while monthly slots remain", () => {
    expect(planChange(family, "family_annual", "price_year", NOW)).toEqual({ ok: false, reason: "has_slots" });
    const plain = stripeSub([["si_plan", "readli_family_monthly_1999"]]);
    expect(planChange(plain, "family_annual", "price_year", NOW)).toMatchObject({ ok: true, upgrade: true, params: { billing_cycle_anchor: "now" } });
    const annual = stripeSub([["si_plan", "readli_family_annual_17999"]]);
    expect(planChange(annual, "family_monthly", "price_month", NOW)).toMatchObject({ ok: true, upgrade: false, params: { billing_cycle_anchor: "now", proration_behavior: "create_prorations" } });
    expect(planChange(annual, "archive_monthly", "price_archive", NOW)).toMatchObject({ ok: true, params: { billing_cycle_anchor: "now" } });
  });

  it("refuses a change during the trial, to the same plan, or on an ended subscription", () => {
    expect(planChange(stripeSub([["si", "readli_family_monthly_1999"]], { status: "trialing", trial_end: NOW + 100 }), "archive_monthly", "p", NOW)).toEqual({ ok: false, reason: "in_trial" });
    expect(planChange(family, "family_monthly", "p", NOW)).toEqual({ ok: false, reason: "same_plan" });
    expect(planChange({ ...family, status: "canceled" }, "archive_monthly", "p", NOW)).toEqual({ ok: false, reason: "not_active" });
  });
});

describe("Stripe events are the source of truth", () => {
  const family = stripeSub([["si_plan", "readli_family_monthly_1999"]]);
  const archive = stripeSub([["si_plan", "readli_archive_monthly_699"]]);
  const annual = stripeSub([["si_plan", "readli_family_annual_17999"]]);

  it("a downgrade then upgrade moves the tier and interval and deletes nothing", async () => {
    const { db, tables } = fakeSupabase({ child_profiles: [{ id: "maya", household_id: "h1" }], narration_segments: [{ library_key: "h1-book" }] });
    await apply(db, subEvent("customer.subscription.created", family, NOW));
    await apply(db, subEvent("customer.subscription.updated", archive, NOW + 10));
    expect(tables.household_entitlements).toEqual([expect.objectContaining({ tier: "archive", status: "active", extra_narrator_slots: 0 })]);
    await apply(db, subEvent("customer.subscription.updated", annual, NOW + 20));
    expect(tables.household_entitlements![0]).toMatchObject({ tier: "family", billing_interval: "year" });
    expect(tables.child_profiles).toHaveLength(1);
    expect(tables.narration_segments).toHaveLength(1);
  });

  it("ignores an older event that arrives late, and a duplicate changes nothing", async () => {
    const { db, tables } = fakeSupabase();
    await apply(db, subEvent("customer.subscription.created", family, NOW));
    await apply(db, subEvent("customer.subscription.updated", archive, NOW + 20));
    await apply(db, subEvent("customer.subscription.updated", family, NOW + 10));
    expect(tables.household_entitlements).toEqual([expect.objectContaining({ tier: "archive" })]);
    await apply(db, subEvent("customer.subscription.updated", archive, NOW + 20));
    expect(tables.household_entitlements).toHaveLength(1);
    expect(tables.lifecycle_audit_log!.filter((x) => x.action === "plan_changed")).toHaveLength(1);
  });

  it("keeps the plan while Stripe retries a failed payment, emails the guardians once, and ends it when Stripe gives up", async () => {
    const { db, tables } = fakeSupabase({
      billing_customers: [{ household_id: "h1", customer_ref: "cus_1" }],
      households: [{ id: "h1", name: "The Riveras" }],
      household_members: [{ household_id: "h1", user_id: "sara", role: "guardian", removed_at: null }],
    });
    await apply(db, subEvent("customer.subscription.created", family, NOW));
    await apply(db, subEvent("customer.subscription.updated", { ...family, status: "past_due" }, NOW + 10));
    expect(tables.household_entitlements![0]).toMatchObject({ status: "active" });
    const failed = { id: "evt_fail", data: { object: { customer: "cus_1", next_payment_attempt: NOW + 86_400 * 3 } } };
    expect(await queuePaymentFailed(db, failed, "https://readli.ai/family/billing")).toBe(1);
    expect(await queuePaymentFailed(db, failed, "https://readli.ai/family/billing")).toBe(0);
    expect(tables.email_outbox).toEqual([expect.objectContaining({ template: "payment_failed", recipient_user_id: "sara", category: "transactional" })]);
    await apply(db, subEvent("customer.subscription.updated", { ...family, status: "unpaid" }, NOW + 20));
    expect(tables.household_entitlements![0]).toMatchObject({ status: "canceled" });
  });

  it("gives a reused card Readli Family without the free trial credits, and records the trial signals", async () => {
    const { db, tables } = fakeSupabase({ trial_signals: [{ signal_hash: cardKey("fp_1"), kind: "payment_method", household_id: "other" }] });
    const trialing = stripeSub([["si_plan", "readli_family_monthly_1999"]], { status: "trialing" });
    const e = subEvent("customer.subscription.created", trialing, NOW, { trial_end: NOW + 14 * 86_400 });
    await applyBillingChange(db, billingChange(e), false, DEFAULT_PLAN, new Date(NOW * 1000), {
      eventAt: iso(NOW),
      trialStart: async (c) => ({ householdId: c.householdId, subscriptionRef: c.subscriptionRef, userId: "sara", email: "Sara+kids@example.com", cardFingerprint: "fp_1" }),
    });
    expect(tables.household_entitlements![0]).toMatchObject({ status: "active", trial_credits: 0 });
    expect(tables.lifecycle_exceptions).toEqual([expect.objectContaining({ kind: "trial_card_reused", household_id: "h1" })]);
    expect(tables.trial_signals!.map((x) => x.signal_hash).sort()).toEqual([accountKey("sara"), cardKey("fp_1"), emailKey("sara@example.com")].sort());
  });
});

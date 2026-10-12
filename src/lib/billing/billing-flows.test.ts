// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import { applyBillingChange } from "./apply";
import { billingChange } from "./events";
import { queuePaymentFailed, reviewCreditOnCancel } from "./notify";
import { describeChange, planChange, previewParams, schedulePhases } from "./plan-change";
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
  const PERIOD_END = NOW + 86_400 * 20;
  const family = stripeSub(
    [
      ["si_plan", "readli_family_monthly_1999"],
      ["si_slot", "readli_extra_slot_599", 2],
    ],
    { current_period_end: PERIOD_END },
  );
  const annual = stripeSub([["si_plan", "readli_family_annual_17999"]], { current_period_end: NOW + 86_400 * 200 });

  it("schedules a downgrade to the Archive for the end of the paid term, dropping slots only then", () => {
    const change = planChange(family, { to: "archive_monthly" }, "price_archive", NOW);
    expect(change).toMatchObject({ ok: true, kind: "scheduled", from: "family_monthly", to: "archive_monthly", upgrade: false, effectiveAt: PERIOD_END });
    if (!change.ok || change.kind !== "scheduled") throw new Error("expected a scheduled change");
    expect(change.current).toEqual([{ price: "price_readli_family_monthly_1999", quantity: 1 }, { price: "price_readli_extra_slot_599", quantity: 2 }]);
    expect(change.next).toEqual([{ price: "price_archive", quantity: 1 }]);
    const phases = schedulePhases({ id: "sched_1", status: "active", phases: [{ start_date: NOW - 100, end_date: PERIOD_END, items: [] }] }, change);
    expect(phases).toMatchObject({
      end_behavior: "release",
      phases: [
        { start_date: NOW - 100, end_date: PERIOD_END, metadata: { household_id: "h1" } },
        { items: [{ price: "price_archive" }], metadata: { household_id: "h1", last_plan_change: "family_monthly->archive_monthly" } },
      ],
    });
  });

  it("schedules annual → Archive at the end of the paid year by default", () => {
    expect(planChange(annual, { to: "archive_monthly" }, "price_archive", NOW)).toMatchObject({ ok: true, kind: "scheduled", effectiveAt: NOW + 86_400 * 200 });
    expect(planChange(annual, { to: "family_monthly" }, "price_month", NOW)).toMatchObject({ ok: true, kind: "scheduled" });
  });

  it("downgrades now only when asked, with unused time credited and no cash refund", () => {
    const change = planChange(family, { to: "archive_monthly", timing: "now" }, "price_archive", NOW);
    expect(change).toMatchObject({ ok: true, kind: "now", upgrade: false });
    expect(change.ok && change.kind === "now" && change.params).toMatchObject({
      items: [{ id: "si_plan", price: "price_archive", quantity: 1 }, { id: "si_slot", deleted: true }],
      proration_behavior: "create_prorations",
    });
    expect(change.ok && change.kind === "now" && change.params).not.toHaveProperty("payment_behavior");
    const yearly = planChange(annual, { to: "family_monthly", timing: "now" }, "price_month", NOW);
    expect(yearly.ok && yearly.kind === "now" && yearly.params).toMatchObject({ billing_cycle_anchor: "now", proration_behavior: "create_prorations" });
  });

  it("upgrades now, only once payment succeeds", () => {
    const archive = stripeSub([["si_plan", "readli_archive_monthly_699"]]);
    const change = planChange(archive, { to: "family_monthly" }, "price_family", NOW);
    expect(change.ok && change.kind === "now" && change.params).toMatchObject({ proration_behavior: "always_invoice", payment_behavior: "pending_if_incomplete", items: [{ id: "si_plan", price: "price_family" }] });
    expect(change.ok && change.kind === "now" && change.params).not.toHaveProperty("metadata");
    const yearly = planChange(archive, { to: "family_annual" }, "price_year", NOW);
    expect(yearly.ok && yearly.kind === "now" && yearly.params).toMatchObject({ billing_cycle_anchor: "now", proration_behavior: "always_invoice" });
    expect(planChange(family, { to: "family_annual" }, "price_year", NOW)).toEqual({ ok: false, reason: "has_slots" });
  });

  describe("during a free trial", () => {
    const trial = stripeSub([["si", "readli_family_monthly_1999"]], { status: "trialing", trial_end: NOW + 86_400 * 9 });

    it("switches monthly ↔ yearly without shortening the trial or charging", () => {
      const change = planChange(trial, { to: "family_annual" }, "price_year", NOW);
      expect(change).toMatchObject({ ok: true, kind: "now", keepsTrial: true, endsTrial: false });
      expect(change.ok && change.kind === "now" && change.params).toMatchObject({ trial_end: NOW + 86_400 * 9, proration_behavior: "none" });
      expect(change.ok && change.kind === "now" && change.params).not.toHaveProperty("billing_cycle_anchor");
    });

    it("waits for the trial to end before a downgrade to the Archive", () => {
      expect(planChange(trial, { to: "archive_monthly", timing: "now" }, "price_archive", NOW)).toMatchObject({ ok: true, kind: "scheduled", effectiveAt: NOW + 86_400 * 9, trialEnd: NOW + 86_400 * 9 });
    });

    it("ends the trial early only with the customer's confirmation", () => {
      expect(planChange(trial, { to: "family_annual", endTrial: true }, "price_year", NOW)).toEqual({ ok: false, reason: "trial_end_unconfirmed" });
      const change = planChange(trial, { to: "family_annual", endTrial: true, trialEndConfirmed: true }, "price_year", NOW);
      expect(change).toMatchObject({ ok: true, kind: "now", endsTrial: true, keepsTrial: false });
      expect(change.ok && change.kind === "now" && change.params).toMatchObject({ trial_end: "now", payment_behavior: "pending_if_incomplete" });
    });
  });

  it("refuses the same plan or an ended subscription", () => {
    expect(planChange(family, { to: "family_monthly" }, "p", NOW)).toEqual({ ok: false, reason: "same_plan" });
    expect(planChange({ ...family, status: "canceled" }, { to: "archive_monthly" }, "p", NOW)).toEqual({ ok: false, reason: "not_active" });
  });

  it("previews the effective date, adjustment and resulting amount", () => {
    const later = planChange(family, { to: "archive_monthly" }, "price_archive", NOW);
    if (!later.ok) throw new Error("expected a change");
    expect(describeChange(family, later, 699, null, null, NOW)).toMatchObject({ timing: "period_end", effectiveAt: iso(PERIOD_END), dueNowCents: 0, creditCents: 0, nextAmountCents: 699, nextBillingAt: iso(PERIOD_END) });

    const now = planChange(family, { to: "archive_monthly", timing: "now" }, "price_archive", NOW);
    if (!now.ok || now.kind !== "now") throw new Error("expected an immediate change");
    expect(previewParams(family, now, NOW)).toMatchObject({ customer: "cus_1", subscription: "sub_1", subscription_details: { proration_behavior: "create_prorations", proration_date: NOW } });
    const invoice = { amount_due: 0, total: -1500, lines: { data: [{ amount: -2400, parent: { subscription_item_details: { proration: true } } }, { amount: 466, proration: true }, { amount: 699, period: { start: PERIOD_END, end: PERIOD_END + 86_400 * 30 } }] } };
    expect(describeChange(family, now, 699, invoice, NOW, NOW)).toMatchObject({ timing: "now", dueNowCents: 0, creditCents: 1934, nextBillingAt: iso(PERIOD_END), prorationDate: NOW });

    const archive = stripeSub([["si_plan", "readli_archive_monthly_699"]], { current_period_end: PERIOD_END });
    const up = planChange(archive, { to: "family_annual" }, "price_year", NOW);
    if (!up.ok || up.kind !== "now") throw new Error("expected an immediate change");
    const upInvoice = { amount_due: 17_500, total: 17_500, lines: { data: [{ amount: -499, proration: true }, { amount: 17_999, period: { start: NOW, end: NOW + 86_400 * 365 } }] } };
    expect(describeChange(archive, up, 17_999, upInvoice, NOW, NOW)).toMatchObject({ dueNowCents: 17_500, creditCents: 0, nextBillingAt: iso(NOW + 86_400 * 365) });

    const trial = stripeSub([["si", "readli_family_monthly_1999"]], { status: "trialing", trial_end: NOW + 500 });
    const keep = planChange(trial, { to: "family_annual" }, "price_year", NOW);
    if (!keep.ok) throw new Error("expected a change");
    expect(describeChange(trial, keep, 17_999, null, null, NOW)).toMatchObject({ keepsTrial: true, dueNowCents: 0, nextBillingAt: iso(NOW + 500) });
  });
});

describe("credit left when a subscription ends", () => {
  it("goes to the admin queue for a refund instead of lapsing", async () => {
    const { db, tables } = fakeSupabase();
    const ended = { type: "customer.subscription.deleted", data: { object: { id: "sub_1", customer: "cus_1", metadata: { household_id: "h1" } } } };
    expect(await reviewCreditOnCancel(db, ended, async () => -1934)).toBe(1934);
    expect(await reviewCreditOnCancel(db, ended, async () => -1934)).toBe(1934);
    expect(tables.lifecycle_exceptions).toEqual([expect.objectContaining({ kind: "billing_credit_refund", household_id: "h1", status: "open", detail: expect.objectContaining({ credit_cents: 1934 }) })]);
    expect(await reviewCreditOnCancel(db, ended, async () => 0)).toBe(0);
    expect(await reviewCreditOnCancel(db, { ...ended, type: "customer.subscription.updated" }, async () => -5)).toBe(0);
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

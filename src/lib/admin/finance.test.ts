import { describe, expect, it } from "vitest";
import { costConfig, financeReport, monthlyValueCents, type FinanceInputs } from "./finance";

const at = new Date("2026-10-11T00:00:00Z");
const days = (d: number) => new Date(at.getTime() + d * 86_400_000).toISOString();

function input(over: Partial<FinanceInputs> = {}): FinanceInputs {
  return {
    at,
    entitlements: [],
    revenue: [],
    members: [],
    adultIds: [],
    voices: [],
    usage: [],
    jobs: [],
    plays: 0,
    storedBytes: 0,
    costs: { ...costConfig({} as NodeJS.ProcessEnv), providerPlanMonthlyUsd: 0 },
    ...over,
  };
}

const sub = (household_id: string, over: Record<string, unknown> = {}) => ({
  id: `e-${household_id}`,
  household_id,
  source: "subscription",
  status: "active",
  extra_narrator_slots: 0,
  starts_at: days(-60),
  ends_at: null,
  ...over,
});

const line = (over: Record<string, unknown>) => ({
  household_id: "h1",
  kind: "subscription",
  amount_cents: 1999,
  billing_interval: "month",
  period_start: days(-10),
  period_end: days(20),
  occurred_at: days(-10),
  ...over,
});

describe("financial report", () => {
  it("counts a yearly plan as a twelfth a month, and only while its paid period covers today", () => {
    expect(monthlyValueCents(line({ amount_cents: 17999, billing_interval: "year", period_end: days(355) }), at.getTime())).toBeCloseTo(1499.92);
    expect(monthlyValueCents(line({ period_end: days(-1) }), at.getTime())).toBe(0);
    expect(monthlyValueCents(line({ kind: "credit_pack", billing_interval: null }), at.getTime())).toBe(0);
  });

  it("keeps slot MRR apart from subscription MRR, and one-time sales out of both", () => {
    const r = financeReport(
      input({
        entitlements: [sub("h1", { extra_narrator_slots: 2 }), sub("h2")],
        revenue: [
          line({}),
          line({ household_id: "h2", amount_cents: 17999, billing_interval: "year", period_end: days(355) }),
          line({ kind: "narrator_slot", amount_cents: 1198, quantity: 2 }),
          line({ kind: "credit_pack", amount_cents: 1499, billing_interval: null, period_start: null, period_end: null }),
          line({ kind: "gift", household_id: null, amount_cents: 5997, billing_interval: null, period_start: null, period_end: null }),
          line({ kind: "credit_pack", amount_cents: 699, billing_interval: null, period_start: null, period_end: null, occurred_at: days(-90) }),
        ],
      }),
    );
    expect(r.subscriptionMrrCents).toBe(1999 + 1500);
    expect(r.slotMrrCents).toBe(1198);
    expect(r.subscriptionArrCents).toBe((1999 + 1500) * 12);
    expect(r.recurringArrCents).toBe((1999 + 1500 + 1198) * 12);
    expect(r.creditPacks30d).toEqual({ cents: 1499, count: 1 });
    expect(r.creditPacksAllTime).toEqual({ cents: 2198, count: 2 });
    expect(r.gifts30d).toEqual({ cents: 5997, count: 1 });
    expect(r.payingFamilies).toBe(2);
    expect(r.slotsPurchased).toBe(2);
    expect(r.arpuCents).toBe(Math.round((1999 + 1500 + 1198) / 2));
    expect(r.revenue30dCents).toBe(1999 + 1500 + 1198 + 1499 + 5997);
  });

  it("subtracts refunds", () => {
    const r = financeReport(
      input({
        revenue: [
          line({ kind: "credit_pack", amount_cents: 2499, billing_interval: null, period_start: null, period_end: null }),
          line({ kind: "credit_pack", amount_cents: -2499, billing_interval: null, period_start: null, period_end: null }),
          line({ amount_cents: -1999 }),
          line({}),
        ],
      }),
    );
    expect(r.creditPacks30d).toEqual({ cents: 0, count: 1 });
    expect(r.subscriptionMrrCents).toBe(0);
  });

  it("splits families by plan and counts free contributors", () => {
    const r = financeReport(
      input({
        entitlements: [sub("h1"), sub("h2", { source: "gift" }), sub("h3", { source: "trial", ends_at: days(5) }), sub("h4", { source: "tester" })],
        members: [
          { household_id: "h1", user_id: "a" },
          { household_id: "h5", user_id: "b" },
        ],
        adultIds: ["a", "b", "c"],
        voices: [{ owner_id: "b" }, { owner_id: "c" }],
      }),
    );
    expect([r.payingFamilies, r.giftFamilies, r.trialFamilies, r.complimentaryFamilies]).toEqual([1, 1, 1, 1]);
    expect(r.voiceContributors).toBe(2);
    expect(r.verifiedVoices).toBe(2);
  });

  it("measures trial conversion and 30-day churn", () => {
    const r = financeReport(
      input({
        entitlements: [
          sub("t1", { source: "trial", starts_at: days(-40), ends_at: days(-26) }),
          sub("t1", { id: "paid-t1", starts_at: days(-26) }),
          sub("t2", { source: "trial", starts_at: days(-20), ends_at: days(-6) }),
          sub("gone", { status: "canceled", ends_at: days(-3) }),
          sub("stays"),
        ],
      }),
    );
    expect(r.trials).toEqual({ active: 0, ended: 2, converted: 1, rate: 0.5 });
    expect(r.churn.startingFamilies).toBe(2);
    expect(r.churn.churned).toBe(1);
    expect(r.churn.rate).toBe(0.5);
    expect(r.churn.retention).toBe(0.5);
  });

  it("prices generation by model, charges it to the family that made it, and doesn't double count the plan", () => {
    const base = input({
      revenue: [line({})],
      usage: [
        { library_key: "L", sentence_id: "s1", model_id: "eleven_multilingual_v2", characters: 10_000, provider_credits: 10_000, bytes: 1024 },
        { library_key: "L", sentence_id: "s2", model_id: "eleven_flash_v2_5", characters: 10_000, provider_credits: 5_000, bytes: 1024 },
      ],
      jobs: [{ library_key: "L", household_id: "h1", sentence_ids: ["s1", "s2"] }],
    });
    const r = financeReport(base);
    expect(r.costs30d.generationUsd).toBeCloseTo(1.5);
    expect(r.costs30d.providerExpenseUsd).toBeCloseTo(1.5);
    expect(r.households).toEqual([{ householdId: "h1", revenueCents: 1999, costUsd: 1.5, marginUsd: 19.99 - 1.5 }]);

    const withPlan = financeReport({ ...base, costs: { ...base.costs, providerPlanMonthlyUsd: 99 } });
    expect(withPlan.costs30d.providerExpenseUsd).toBe(99);
    expect(withPlan.costs30d.totalUsd).toBeCloseTo(99);
    expect(withPlan.operatingContributionUsd).toBeCloseTo(19.99 - 99);
  });

  it("prefers recorded provider cost and household over the estimate", () => {
    const r = financeReport(
      input({
        usage: [
          { library_key: "L", sentence_id: "s1", model_id: "eleven_multilingual_v2", characters: 10_000, provider_credits: 10_000, bytes: 0, usd: "0.250000", household_id: "h2" },
          { library_key: "L", sentence_id: "s2", model_id: "eleven_multilingual_v2", characters: 10_000, provider_credits: 10_000, bytes: 0, usd: null },
        ],
        jobs: [{ library_key: "L", household_id: "h1", sentence_ids: ["s1", "s2"] }],
      }),
    );
    expect(r.costs30d.generationUsd).toBeCloseTo(1.25);
    expect(r.households.map((h) => [h.householdId, h.costUsd])).toEqual([
      ["h1", 1],
      ["h2", 0.25],
    ]);
  });

  it("reads cost overrides from env and ignores bad values", () => {
    const c = costConfig({ FINANCE_COST_PER_1K_CHARS_USD: "0.2", FINANCE_PROVIDER_PLAN_MONTHLY_USD: "abc" } as unknown as NodeJS.ProcessEnv);
    expect(c.defaultPer1kUsd).toBe(0.2);
    expect(c.providerPlanMonthlyUsd).toBe(22);
    expect(c.providerPlanName).toBe("Creator");
    expect(c.per1kUsd.eleven_flash_v2_5).toBe(0.05);
  });

  it("prefers the admin's saved cost settings over env and defaults", () => {
    const c = costConfig({ FINANCE_PROVIDER_PLAN_MONTHLY_USD: "5" } as unknown as NodeJS.ProcessEnv, {
      provider_plan_name: "Pro",
      provider_plan_monthly_usd: "99.00",
      cost_per_1k_chars_usd: 0.12,
      low_cost_per_1k_chars_usd: 0.06,
      storage_usd_per_gb_month: null,
    });
    expect(c.providerPlanName).toBe("Pro");
    expect(c.providerPlanMonthlyUsd).toBe(99);
    expect(c.defaultPer1kUsd).toBe(0.12);
    expect(c.per1kUsd.eleven_turbo_v2_5).toBe(0.06);
    expect(c.storageUsdPerGbMonth).toBe(0.021);
    expect(costConfig({ FINANCE_PROVIDER_PLAN_MONTHLY_USD: "5" } as unknown as NodeJS.ProcessEnv).providerPlanMonthlyUsd).toBe(5);
  });
});

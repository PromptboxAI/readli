// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { dollarsToCents, effectivePlan, LIMIT_FIELDS, parseLimitsForm, parsePriceForm, priceSettingsRow, withPriceSettings } from "./price-settings";

const form = (values: Record<string, string>) => (name: string) => values[name] ?? "";
const good = {
  family_monthly: "21.99",
  family_annual: "$199",
  extra_slot: "6.49",
  extra_slot_approved: "on",
  pack_id_1: "pack-small",
  pack_credits_1: "20",
  pack_price_1: "6.99",
  pack_credits_2: "50",
  pack_price_2: "14.99",
};

describe("admin prices", () => {
  it("reads dollar amounts", () => {
    expect(dollarsToCents("19.99")).toBe(1999);
    expect(dollarsToCents("$5.9")).toBe(590);
    expect(dollarsToCents("180")).toBe(18000);
    for (const bad of ["", "0", "abc", "1.999", "-2"]) expect(dollarsToCents(bad)).toBeNull();
  });

  it("parses the form into prices and packs", () => {
    const parsed = parsePriceForm(form(good));
    expect(parsed).toEqual({
      ok: true,
      settings: {
        familyMonthlyPriceCents: 2199,
        familyAnnualPriceCents: 19900,
        extraSlotPriceCents: 649,
        extraSlotPriceApproved: true,
        creditPacks: [
          { id: "pack-small", credits: 20, priceCents: 699 },
          { id: "pack-2", credits: 50, priceCents: 1499 },
        ],
      },
    });
  });

  it("explains what's wrong instead of saving a bad price", () => {
    expect(parsePriceForm(form({ ...good, family_monthly: "free" }))).toEqual({ ok: false, error: "The monthly price needs a price like 19.99." });
    expect(parsePriceForm(form({ ...good, pack_credits_2: "1.5" }))).toMatchObject({ ok: false, error: "Credit pack 2 needs a whole number of credits." });
    expect(parsePriceForm(form({ ...good, pack_credits_1: "", pack_price_1: "", pack_credits_2: "", pack_price_2: "" }))).toMatchObject({ ok: false, error: "Keep at least one credit pack." });
    expect(parsePriceForm(form({ ...good, pack_id_2: "pack-small" }))).toMatchObject({ ok: false, error: "Each credit pack needs its own id." });
  });

  it("puts saved prices on top of the plan, ignoring anything malformed", () => {
    const parsed = parsePriceForm(form(good));
    if (!parsed.ok) throw new Error(parsed.error);
    const plan = withPriceSettings(DEFAULT_PLAN, priceSettingsRow(parsed.settings));
    expect(plan).toMatchObject({ familyMonthlyPriceCents: 2199, familyAnnualPriceCents: 19900, extraSlotPriceCents: 649, creditPacks: parsed.settings.creditPacks });
    expect(withPriceSettings(DEFAULT_PLAN, { family_monthly_price_cents: -1, credit_packs: [{ id: "", credits: 1, priceCents: 1 }] })).toEqual(DEFAULT_PLAN);
    expect(withPriceSettings(DEFAULT_PLAN, null)).toBe(DEFAULT_PLAN);
  });

  it("uses the defaults when there's no database, and the saved row when there is", async () => {
    expect(await effectivePlan(null, DEFAULT_PLAN)).toBe(DEFAULT_PLAN);
    const db = { from: () => ({ select: () => ({ maybeSingle: async () => ({ data: { family_monthly_price_cents: 2499 } }) }) }) };
    expect((await effectivePlan(db as never, DEFAULT_PLAN)).familyMonthlyPriceCents).toBe(2499);
  });
});

describe("admin generation limits", () => {
  const L = DEFAULT_PLAN.generationLimits;

  it("applies saved limits on top of the defaults and ignores bad values", () => {
    const plan = withPriceSettings(DEFAULT_PLAN, { generation_limits: { requestsPerHour: 12, dailySpendUsd: 42.5, trialRequestsPerDay: -1, maxConcurrentJobs: "3" } });
    expect(plan.generationLimits).toEqual({ ...L, requestsPerHour: 12, dailySpendUsd: 42.5 });
    expect(withPriceSettings(DEFAULT_PLAN, { generation_limits: null }).generationLimits).toEqual(L);
  });

  it("reads the limits form, refusing blanks and fractions where a whole number is needed", () => {
    const all = Object.fromEntries(LIMIT_FIELDS.map((f) => [`limit_${f.key}`, String(L[f.key])]));
    expect(parseLimitsForm(form(all))).toEqual({ ok: true, limits: L });
    expect(parseLimitsForm(form({ ...all, limit_dailySpendUsd: "12.50" }))).toMatchObject({ ok: true, limits: { dailySpendUsd: 12.5 } });
    expect(parseLimitsForm(form({ ...all, limit_requestsPerHour: "2.5" }))).toMatchObject({ ok: false });
    expect(parseLimitsForm(form({ ...all, limit_trialMaxConcurrentJobs: "" }))).toMatchObject({ ok: false });
  });
});

import { planConfig, type PlanConfig } from "@/lib/family/plan";

/**
 * What /pricing shows (Kevin's pricing pack, 2026-10-11). Plan prices and allowances come from the
 * plan config, the one source checkout and the admin portal also read. The credit unit, monthly
 * credits, trial and credit packs below are still constants because the plan config hasn't moved to
 * the 1,000-character credit yet; switch them to planConfig() when it does. Payments aren't live.
 */
export const CREDIT_PRICING = {
  monthlyCredits: 40,
  /** One Readli credit pays for this many characters of new narration. */
  charactersPerCredit: 1000,
  trialDays: 14,
  trialCredits: 10,
  creditPacks: [
    { credits: 20, priceCents: 699 },
    { credits: 50, priceCents: 1499 },
    { credits: 100, priceCents: 2499 },
  ],
} as const;

export function pricing(plan: PlanConfig = planConfig()) {
  return {
    familyMonthlyCents: plan.familyMonthlyPriceCents,
    familyAnnualCents: plan.familyAnnualPriceCents,
    includedNarratorSlots: plan.includedNarratorSlots,
    extraSlotMonthlyCents: plan.extraSlotPriceCents,
    maxChildProfiles: plan.maxChildProfiles,
    simultaneousListeners: plan.includedConcurrentStreams,
    ...CREDIT_PRICING,
  };
}

export type Pricing = ReturnType<typeof pricing>;

/** Monthly total for a household with this many active narrators. */
export function monthlyTotalCents(p: Pricing, narrators: number): number {
  return p.familyMonthlyCents + Math.max(0, narrators - p.includedNarratorSlots) * p.extraSlotMonthlyCents;
}

/** How much the annual plan saves against twelve monthly payments, as a whole percentage. */
export function annualSavingsPercent(p: Pricing): number {
  return Math.round((1 - p.familyAnnualCents / (12 * p.familyMonthlyCents)) * 100);
}

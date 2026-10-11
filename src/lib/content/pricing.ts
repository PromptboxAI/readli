import { effectivePlan } from "@/lib/billing/price-settings";
import { accountDb } from "@/lib/family/account-store";
import type { PlanConfig } from "@/lib/family/plan";
import { rewardsConfig } from "@/lib/rewards/rewards";

/**
 * What /pricing shows (Kevin's pricing pack, 2026-10-11): the same plan checkout uses, with any
 * prices an admin saved on /admin/plans. The trial length comes from the rewards settings, where the
 * trial is configured. Payments aren't live, so the page never links to a checkout.
 */
export function toPricing(plan: PlanConfig, trialDays: number) {
  return {
    familyMonthlyCents: plan.familyMonthlyPriceCents,
    familyAnnualCents: plan.familyAnnualPriceCents,
    includedNarratorSlots: plan.includedNarratorSlots,
    extraSlotMonthlyCents: plan.extraSlotPriceCents,
    maxChildProfiles: plan.maxChildProfiles,
    simultaneousListeners: plan.includedConcurrentStreams,
    monthlyCredits: plan.monthlyCredits,
    charactersPerCredit: plan.charactersPerCredit,
    trialCredits: plan.trialCredits,
    trialDays,
    creditPacks: plan.creditPacks,
  };
}

export type Pricing = ReturnType<typeof toPricing>;

export async function pricing(): Promise<Pricing> {
  return toPricing(await effectivePlan(accountDb()), rewardsConfig().trialDays);
}

/** Monthly total for a household with this many active narrators. */
export function monthlyTotalCents(p: Pricing, narrators: number): number {
  return p.familyMonthlyCents + Math.max(0, narrators - p.includedNarratorSlots) * p.extraSlotMonthlyCents;
}

/** How much the annual plan saves against twelve monthly payments, as a whole percentage. */
export function annualSavingsPercent(p: Pricing): number {
  return Math.round((1 - p.familyAnnualCents / (12 * p.familyMonthlyCents)) * 100);
}

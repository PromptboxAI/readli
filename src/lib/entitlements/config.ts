/**
 * Plan settings (Final Signup Architecture and Subscription Pricing amendment, Kevin 2026-10-10).
 * Every value is admin-configurable; these are the launch defaults. The database copy
 * (public.plan_settings) wins once the admin portal saves it.
 */
export interface PlanConfig {
  /** Readli Family monthly price, in cents. */
  familyMonthlyPriceCents: number;
  /** Active narrator slots included with Readli Family. */
  includedNarratorSlots: number;
  /** Extra active narrator slot, per month, in cents. */
  extraNarratorSlotPriceCents: number;
  /** "proposed" until pricing and provider costs are approved; extra slots aren't sold until "approved". */
  extraNarratorSlotPriceStatus: "proposed" | "approved";
  /** Verified voices per free Readli Voice adult. */
  freeContributorVoiceAllowance: number;
  /** Separately verified adults in one free contributor household (e.g. Grandma and Grandpa). */
  contributorHouseholdMaxAdults: number;
  maxChildProfiles: number;
  includedConcurrentStreams: number;
  /** Future paid upgrade. Modelled, never shown or sold until approved. */
  extraStreamsForSale: false;
  /** Gifted memberships grant the same household entitlements as a paid Readli Family plan. */
  giftedMembershipEntitlements: "same_as_family";
  /** Anti-abuse: narrator activations allowed per rolling 30 days beyond filling every slot once. */
  narratorSwapsPer30Days: number;
  /** Voice-processing limits. */
  voiceRecordingAttemptsPerDay: number;
  voiceReplacementsPerYear: number;
}

export const DEFAULT_PLAN: PlanConfig = {
  familyMonthlyPriceCents: 1499,
  includedNarratorSlots: 2,
  extraNarratorSlotPriceCents: 299,
  extraNarratorSlotPriceStatus: "proposed",
  freeContributorVoiceAllowance: 1,
  contributorHouseholdMaxAdults: 2,
  maxChildProfiles: 6,
  includedConcurrentStreams: 3,
  extraStreamsForSale: false,
  giftedMembershipEntitlements: "same_as_family",
  narratorSwapsPer30Days: 2,
  voiceRecordingAttemptsPerDay: 5,
  voiceReplacementsPerYear: 3,
};

export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

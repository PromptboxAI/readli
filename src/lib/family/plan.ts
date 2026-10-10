/**
 * Readli Family plan settings (Final Signup Architecture and Subscription Pricing amendment).
 * Defaults are Kevin's numbers; the admin portal overrides them (plan_settings table, or PLAN_*
 * env vars until that exists). Prices are in cents.
 */
export interface PlanConfig {
  familyMonthlyPriceCents: number;
  includedNarratorSlots: number;
  extraSlotPriceCents: number;
  /** The $2.99 extra slot is proposed, pending pricing approval and provider cost validation. */
  extraSlotPriceApproved: boolean;
  freeContributorVoices: number;
  maxChildProfiles: number;
  includedConcurrentStreams: number;
  /** Extra concurrent streams are a possible future upgrade; never offered while false. */
  extraStreamsUpgradeEnabled: boolean;
  /** Anti-abuse: how many slots a household may release (to reassign) in a rolling 30 days. */
  slotReleasesPer30Days: number;
  /** A listening session with no heartbeat for this long no longer counts as playing. */
  sessionStaleMs: number;
}

export const DEFAULT_PLAN: PlanConfig = {
  familyMonthlyPriceCents: 1499,
  includedNarratorSlots: 2,
  extraSlotPriceCents: 299,
  extraSlotPriceApproved: false,
  freeContributorVoices: 1,
  maxChildProfiles: 6,
  includedConcurrentStreams: 3,
  extraStreamsUpgradeEnabled: false,
  slotReleasesPer30Days: 4,
  sessionStaleMs: 90_000,
};

export function planConfig(env: NodeJS.ProcessEnv = process.env): PlanConfig {
  const num = (key: string, fallback: number) => {
    const n = Number(env[key]);
    return env[key] !== undefined && Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    ...DEFAULT_PLAN,
    familyMonthlyPriceCents: num("PLAN_FAMILY_PRICE_CENTS", DEFAULT_PLAN.familyMonthlyPriceCents),
    includedNarratorSlots: num("PLAN_INCLUDED_SLOTS", DEFAULT_PLAN.includedNarratorSlots),
    extraSlotPriceCents: num("PLAN_EXTRA_SLOT_PRICE_CENTS", DEFAULT_PLAN.extraSlotPriceCents),
    extraSlotPriceApproved: env.PLAN_EXTRA_SLOT_PRICE_APPROVED === "true",
    freeContributorVoices: num("PLAN_FREE_CONTRIBUTOR_VOICES", DEFAULT_PLAN.freeContributorVoices),
    maxChildProfiles: num("PLAN_MAX_CHILD_PROFILES", DEFAULT_PLAN.maxChildProfiles),
    includedConcurrentStreams: num("PLAN_INCLUDED_STREAMS", DEFAULT_PLAN.includedConcurrentStreams),
  };
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

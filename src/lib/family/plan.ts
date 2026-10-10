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
  /** New narration each household may generate per month. Provisional test setting (30), not a promise. */
  monthlyNarrationMinutes: number;
  /** Price for purchased narration minutes; purchases stay off until approved. */
  narrationMinutePriceCents: number;
  narrationPurchasesEnabled: boolean;
  /**
   * Whether one household's narration can be reused by other authorized households. Needs the
   * ElevenLabs OEM / stored-audio / children's-listening confirmations before launch; preview only.
   */
  crossHouseholdReuse: boolean;
  /** ElevenLabs model and settings that define a narration library. */
  narrationModelId: string;
  playbackUrlTtlSeconds: number;
  maxSegmentAttempts: number;
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
  monthlyNarrationMinutes: 30,
  narrationMinutePriceCents: 25,
  narrationPurchasesEnabled: false,
  crossHouseholdReuse: true,
  narrationModelId: "eleven_multilingual_v2",
  playbackUrlTtlSeconds: 120,
  maxSegmentAttempts: 3,
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
    monthlyNarrationMinutes: num("PLAN_NARRATION_MINUTES", DEFAULT_PLAN.monthlyNarrationMinutes),
    narrationMinutePriceCents: num("PLAN_NARRATION_MINUTE_PRICE_CENTS", DEFAULT_PLAN.narrationMinutePriceCents),
    narrationPurchasesEnabled: env.PLAN_NARRATION_PURCHASES_ENABLED === "true",
    // Off in production until the ElevenLabs reuse confirmations are in; on for the preview.
    crossHouseholdReuse: env.NARRATION_CROSS_HOUSEHOLD_REUSE ? env.NARRATION_CROSS_HOUSEHOLD_REUSE === "true" : env.NODE_ENV !== "production" || env.VOICE_PROVIDER === "stub",
    narrationModelId: env.ELEVENLABS_MODEL_ID ?? DEFAULT_PLAN.narrationModelId,
  };
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

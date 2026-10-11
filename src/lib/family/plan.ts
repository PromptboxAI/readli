/**
 * Readli Family plan settings. The one source of Readli's prices: checkout, signup, the pricing page
 * and the admin portal all read them from here. Defaults are Kevin's numbers (Updated Pricing, Credits
 * & Subscription Architecture, 2026-10-11); the admin portal overrides them (plan_settings table, or
 * PLAN_* env vars until that exists). Prices are in cents.
 */
export interface PlanConfig {
  familyMonthlyPriceCents: number;
  /** Same entitlements as monthly; monthly credits still refresh each month rather than all up front. */
  familyAnnualPriceCents: number;
  includedNarratorSlots: number;
  extraSlotPriceCents: number;
  /** Whether the extra slot price is approved for sale. Selling still needs payments switched on. */
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
  /** Readli credits included each billing month, shared by the household (annual plans also refresh monthly). */
  monthlyCredits: number;
  /** Readli credits for a whole free trial, kept apart from paid credits. */
  trialCredits: number;
  /** One Readli credit pays for this many characters of new narration. Balances are kept in characters. */
  charactersPerCredit: number;
  /** One-time credit packs for active Readli Family households (Kevin, 2026-10-11). */
  creditPacks: CreditPack[];
  /** Real checkout for credit packs. Off until payments and pack pricing are approved. */
  narrationPurchasesEnabled: boolean;
  /** Purchased credits expire this many months after purchase (0 = never). */
  purchasedCreditMonths: number;
  /** Unused monthly credits stay spendable for this many extra months (0 = no rollover). */
  subscriptionRolloverMonths: number;
  /** Promotional credits granted to a household when Readli Family starts, and how long they last. */
  welcomePromoCredits: number;
  welcomePromoDays: number;
  /** Books whose full narration is at most this long count as Quick Stories. */
  quickStoryMaxMinutes: number;
  /** Short stories suggested first to new households (onboarding), in order. */
  recommendedShortStories: string[];
  /** The Bedtime Favorites collection, in order. */
  bedtimeFavorites: string[];
  /** Whether parents may prepare one chapter at a time. */
  chapterGenerationEnabled: boolean;
  /** Preview only: buying a credit pack adds credits without taking payment. */
  simulatedCheckout: boolean;
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

export interface CreditPack {
  id: string;
  credits: number;
  priceCents: number;
}

export const DEFAULT_PLAN: PlanConfig = {
  familyMonthlyPriceCents: 1999,
  familyAnnualPriceCents: 17999,
  includedNarratorSlots: 2,
  extraSlotPriceCents: 599,
  extraSlotPriceApproved: true,
  freeContributorVoices: 1,
  maxChildProfiles: 6,
  includedConcurrentStreams: 3,
  extraStreamsUpgradeEnabled: false,
  slotReleasesPer30Days: 4,
  sessionStaleMs: 90_000,
  monthlyCredits: 40,
  trialCredits: 10,
  charactersPerCredit: 1000,
  creditPacks: [
    { id: "pack-small", credits: 20, priceCents: 699 },
    { id: "pack-medium", credits: 50, priceCents: 1499 },
    { id: "pack-large", credits: 100, priceCents: 2499 },
  ],
  narrationPurchasesEnabled: false,
  purchasedCreditMonths: 12,
  subscriptionRolloverMonths: 0,
  welcomePromoCredits: 0,
  welcomePromoDays: 30,
  quickStoryMaxMinutes: 3,
  recommendedShortStories: ["the-tale-of-peter-rabbit", "the-lion-and-the-mouse", "the-three-little-pigs"],
  bedtimeFavorites: ["the-princess-and-the-pea", "winnie-the-pooh", "the-tale-of-peter-rabbit"],
  chapterGenerationEnabled: true,
  simulatedCheckout: false,
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
    familyAnnualPriceCents: num("PLAN_FAMILY_ANNUAL_PRICE_CENTS", DEFAULT_PLAN.familyAnnualPriceCents),
    includedNarratorSlots: num("PLAN_INCLUDED_SLOTS", DEFAULT_PLAN.includedNarratorSlots),
    extraSlotPriceCents: num("PLAN_EXTRA_SLOT_PRICE_CENTS", DEFAULT_PLAN.extraSlotPriceCents),
    extraSlotPriceApproved: env.PLAN_EXTRA_SLOT_PRICE_APPROVED ? env.PLAN_EXTRA_SLOT_PRICE_APPROVED === "true" : DEFAULT_PLAN.extraSlotPriceApproved,
    freeContributorVoices: num("PLAN_FREE_CONTRIBUTOR_VOICES", DEFAULT_PLAN.freeContributorVoices),
    maxChildProfiles: num("PLAN_MAX_CHILD_PROFILES", DEFAULT_PLAN.maxChildProfiles),
    includedConcurrentStreams: num("PLAN_INCLUDED_STREAMS", DEFAULT_PLAN.includedConcurrentStreams),
    monthlyCredits: num("PLAN_MONTHLY_CREDITS", DEFAULT_PLAN.monthlyCredits),
    // Same setting the rewards program reads (src/lib/rewards), so the two never disagree.
    trialCredits: num("REWARDS_TRIAL_CREDITS", DEFAULT_PLAN.trialCredits),
    charactersPerCredit: Math.max(1, num("PLAN_CHARACTERS_PER_CREDIT", DEFAULT_PLAN.charactersPerCredit)),
    creditPacks: packs(env.PLAN_CREDIT_PACKS) ?? DEFAULT_PLAN.creditPacks,
    narrationPurchasesEnabled: env.PLAN_NARRATION_PURCHASES_ENABLED === "true",
    purchasedCreditMonths: num("PLAN_PURCHASED_CREDIT_MONTHS", DEFAULT_PLAN.purchasedCreditMonths),
    subscriptionRolloverMonths: num("PLAN_ROLLOVER_MONTHS", DEFAULT_PLAN.subscriptionRolloverMonths),
    welcomePromoCredits: num("PLAN_WELCOME_PROMO_CREDITS", DEFAULT_PLAN.welcomePromoCredits),
    welcomePromoDays: num("PLAN_WELCOME_PROMO_DAYS", DEFAULT_PLAN.welcomePromoDays),
    quickStoryMaxMinutes: num("PLAN_QUICK_STORY_MAX_MINUTES", DEFAULT_PLAN.quickStoryMaxMinutes),
    recommendedShortStories: list(env.PLAN_RECOMMENDED_SHORT_STORIES) ?? DEFAULT_PLAN.recommendedShortStories,
    bedtimeFavorites: list(env.PLAN_BEDTIME_FAVORITES) ?? DEFAULT_PLAN.bedtimeFavorites,
    chapterGenerationEnabled: env.PLAN_CHAPTER_GENERATION !== "false",
    // The family preview (dev, CI, stub voices) simulates checkout; production needs real payments.
    simulatedCheckout: env.NODE_ENV !== "production" || env.VOICE_PROVIDER === "stub" || env.FAMILY_DEMO === "1",
    // Off in production until the ElevenLabs reuse confirmations are in; on for the preview.
    crossHouseholdReuse: env.NARRATION_CROSS_HOUSEHOLD_REUSE ? env.NARRATION_CROSS_HOUSEHOLD_REUSE === "true" : env.NODE_ENV !== "production" || env.VOICE_PROVIDER === "stub",
    narrationModelId: env.ELEVENLABS_MODEL_ID ?? DEFAULT_PLAN.narrationModelId,
  };
}

function list(value: string | undefined): string[] | null {
  const items = value?.split(",").map((x) => x.trim()).filter(Boolean);
  return items?.length ? items : null;
}

/** PLAN_CREDIT_PACKS="20:699,50:1499" (credits:cents). */
function packs(value: string | undefined): CreditPack[] | null {
  const items = list(value)?.map((x, i) => {
    const [credits, cents] = x.split(":").map(Number);
    return { id: `pack-${i + 1}`, credits: credits!, priceCents: cents! };
  });
  return items?.every((p) => Number.isInteger(p.credits) && p.credits > 0 && Number.isInteger(p.priceCents) && p.priceCents >= 0) ? items : null;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

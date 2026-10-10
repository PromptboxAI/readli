/**
 * Readli Rewards (Kevin, 2026-10-10, revised the same day). Adults only: shown in onboarding and the
 * Readli Family account, never in Readli Kids. Social follows, likes and other third-party
 * engagement never earn anything (see Follow Readli's Story).
 *
 * - Eligible new Readli Family households get a 14-day free trial with a small narration allowance.
 * - A referrer earns one free subscription month once the household they referred has paid for
 *   its second monthly billing cycle itself. At most three such months per rolling 12 months.
 * - A free month waives one subscription charge. It never adds a narration allowance on top of the
 *   household's normal one.
 * - Every limit is admin-configurable, and nothing is public until the program is switched on.
 */
export type ActivityId = "family_account" | "family_library" | "invite_storyteller" | "first_voice_or_story" | "referral";

export interface Activity {
  id: ActivityId;
  title: string;
  detail: string;
  /** Sticker Readi hands out; keepsakes only, no cash value. */
  sticker: string;
}

export const ACTIVITIES: readonly Activity[] = [
  { id: "family_account", title: "Create your family account", detail: "Your private home for family stories.", sticker: "Home sweet home" },
  { id: "family_library", title: "Set up your family library", detail: "Pick the first books for your shelf.", sticker: "Bookworm" },
  {
    id: "invite_storyteller",
    title: "Invite a family storyteller",
    detail: "Ask someone special to record their voice.",
    sticker: "Story circle",
  },
  {
    id: "first_voice_or_story",
    title: "Record your voice or hear a first story",
    detail: "Record a voice you own, or play your first family story.",
    sticker: "Once upon a time",
  },
  {
    id: "referral",
    title: "Refer a new household",
    detail: "Earns a free month once they've paid for two months.",
    sticker: "Story spreader",
  },
];

export const STARTER_ACTIVITIES: readonly ActivityId[] = ["family_account", "family_library", "invite_storyteller", "first_voice_or_story"];

// ---------------------------------------------------------------------------
// Settings (admin-configurable)
// ---------------------------------------------------------------------------

export interface RewardsConfig {
  /** Off until Kevin switches the program on. While off, production never shows rewards or referrals. */
  programPublic: boolean;
  trialDays: number;
  /** New narration a trial household may generate during its trial. */
  trialNarrationMinutes: number;
  /** Paid monthly cycles the referred household must complete before the referrer earns a month. */
  referralPaidCyclesRequired: number;
  /** Free months a household can earn from referrals in any rolling 12 months. */
  referralMonthsPerRolling12: number;
}

export const DEFAULT_REWARDS: RewardsConfig = {
  programPublic: false,
  trialDays: 14,
  trialNarrationMinutes: 10,
  referralPaidCyclesRequired: 2,
  referralMonthsPerRolling12: 3,
};

/** reward_settings table once admin sign-in exists; REWARDS_* settings until then. */
export function rewardsConfig(env: NodeJS.ProcessEnv = process.env): RewardsConfig {
  const int = (key: string, fallback: number) => {
    const n = Number(env[key]);
    return env[key] !== undefined && Number.isInteger(n) && n >= 0 ? n : fallback;
  };
  return {
    programPublic: env.REWARDS_PROGRAM_PUBLIC === "true",
    trialDays: int("REWARDS_TRIAL_DAYS", DEFAULT_REWARDS.trialDays),
    trialNarrationMinutes: int("REWARDS_TRIAL_NARRATION_MINUTES", DEFAULT_REWARDS.trialNarrationMinutes),
    referralPaidCyclesRequired: Math.max(1, int("REWARDS_REFERRAL_PAID_CYCLES", DEFAULT_REWARDS.referralPaidCyclesRequired)),
    referralMonthsPerRolling12: int("REWARDS_REFERRAL_MONTHS_PER_12", DEFAULT_REWARDS.referralMonthsPerRolling12),
  };
}

/**
 * Whether rewards and referrals show at all. Production shows them only once the program is public;
 * previews keep showing them so the design can be reviewed.
 */
export function rewardsVisible(config: RewardsConfig = rewardsConfig(), env: NodeJS.ProcessEnv = process.env): boolean {
  return config.programPublic || env.VERCEL_ENV !== "production";
}

// ---------------------------------------------------------------------------
// Free trial
// ---------------------------------------------------------------------------

/** What Readli already knows about a household asking for a trial. */
export interface TrialFacts {
  /** Any adult in the household has had a Readli Family trial, subscription or gift before. */
  adultsHadFamilyBefore: boolean;
  /** The verified email, phone or payment method was already used for a trial elsewhere. */
  sharedSignalUsedForTrial: boolean;
}

export type TrialDecision = { eligible: true } | { eligible: false; reason: "program_off" | "not_new" | "duplicate_account" };

export function trialEligibility(facts: TrialFacts, config: RewardsConfig = DEFAULT_REWARDS): TrialDecision {
  if (!config.programPublic) return { eligible: false, reason: "program_off" };
  if (facts.adultsHadFamilyBefore) return { eligible: false, reason: "not_new" };
  if (facts.sharedSignalUsedForTrial) return { eligible: false, reason: "duplicate_account" };
  return { eligible: true };
}

export interface TrialGrant {
  startsAt: Date;
  endsAt: Date;
  narrationSeconds: number;
}

export function startTrial(at: Date, config: RewardsConfig = DEFAULT_REWARDS): TrialGrant {
  return {
    startsAt: at,
    endsAt: new Date(at.getTime() + config.trialDays * 86_400_000),
    narrationSeconds: config.trialNarrationMinutes * 60,
  };
}

/**
 * New narration a household may generate in a period. A trial gets the small trial allowance; a
 * paying household gets its plan's monthly allowance, once, whether or not a free month covers the
 * charge. Reward months change the bill, never the allowance.
 */
export function narrationAllowanceSeconds(
  period: { kind: "trial" } | { kind: "subscription"; coveredByRewardMonth: boolean },
  monthlyNarrationMinutes: number,
  config: RewardsConfig = DEFAULT_REWARDS,
): number {
  return period.kind === "trial" ? config.trialNarrationMinutes * 60 : monthlyNarrationMinutes * 60;
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

export interface Referral {
  referrerHouseholdId: string;
  referredHouseholdId: string;
  /** When the referred household signed up through the link. */
  attributedAt: Date;
}

/** What Readli knows about the referred household when its billing changes. */
export interface ReferralFacts {
  referral: Referral;
  /** The two households share an adult, or a verified email, phone or payment method. */
  sharesIdentityWithReferrer: boolean;
  /** The referred household's adults had Readli Family before the referral. */
  referredHadFamilyBefore: boolean;
  /** Another referral for this household was attributed earlier (first link wins). */
  earlierReferralExists: boolean;
  /** The referrer's household was itself referred by the household it is now referring (A refers B, B refers A). */
  referrerWasReferredByReferred: boolean;
  /**
   * Monthly cycles the referred household paid for itself, with a successful charge. Trial days,
   * gift months, donated months and reward months don't count.
   */
  successfulPaidCycles: number;
}

export type ReferralStatus =
  | { status: "pending"; cyclesLeft: number }
  | { status: "qualified" }
  | { status: "rejected"; reason: "self_referral" | "existing_customer" | "already_referred" | "circular" };

export function referralStatus(facts: ReferralFacts, config: RewardsConfig = DEFAULT_REWARDS): ReferralStatus {
  const r = facts.referral;
  if (r.referrerHouseholdId === r.referredHouseholdId || facts.sharesIdentityWithReferrer) return { status: "rejected", reason: "self_referral" };
  if (facts.referredHadFamilyBefore) return { status: "rejected", reason: "existing_customer" };
  if (facts.earlierReferralExists) return { status: "rejected", reason: "already_referred" };
  if (facts.referrerWasReferredByReferred) return { status: "rejected", reason: "circular" };
  const left = config.referralPaidCyclesRequired - facts.successfulPaidCycles;
  return left > 0 ? { status: "pending", cyclesLeft: left } : { status: "qualified" };
}

export interface RewardMonth {
  householdId: string;
  /** The referred household this month was earned for; one month per referred household, ever. */
  referredHouseholdId: string;
  grantedAt: Date;
}

const YEAR_MS = 365 * 86_400_000;

/** Months earned in the 12 months before `at`. */
export function referralMonthsInWindow(grants: readonly RewardMonth[], householdId: string, at: Date): number {
  return grants.filter((g) => g.householdId === householdId && g.grantedAt.getTime() > at.getTime() - YEAR_MS && g.grantedAt <= at).length;
}

export type GrantDecision =
  | { granted: true; month: RewardMonth }
  | { granted: false; reason: "program_off" | "not_qualified" | "already_rewarded" | "cap_reached"; nextOpening?: Date };

/**
 * Decide whether a qualified referral earns its referrer a free month now. Never stacks: one month
 * per referred household, and nothing beyond the rolling cap (missed months aren't banked).
 */
export function grantReferralMonth(
  facts: ReferralFacts,
  grants: readonly RewardMonth[],
  at: Date,
  config: RewardsConfig = DEFAULT_REWARDS,
): GrantDecision {
  if (!config.programPublic) return { granted: false, reason: "program_off" };
  if (referralStatus(facts, config).status !== "qualified") return { granted: false, reason: "not_qualified" };
  const { referrerHouseholdId, referredHouseholdId } = facts.referral;
  if (grants.some((g) => g.referredHouseholdId === referredHouseholdId)) return { granted: false, reason: "already_rewarded" };
  const recent = grants
    .filter((g) => g.householdId === referrerHouseholdId && g.grantedAt.getTime() > at.getTime() - YEAR_MS && g.grantedAt <= at)
    .sort((a, b) => a.grantedAt.getTime() - b.grantedAt.getTime());
  if (recent.length >= config.referralMonthsPerRolling12) {
    return { granted: false, reason: "cap_reached", nextOpening: new Date(recent[0]!.grantedAt.getTime() + YEAR_MS) };
  }
  return { granted: true, month: { householdId: referrerHouseholdId, referredHouseholdId, grantedAt: at } };
}

/**
 * Apply banked free months to a subscription charge: one month waives one charge. Only the
 * subscription price is waived; extra-slot add-ons and narration purchases are still billed.
 */
export function applyRewardMonth(charge: { subscriptionCents: number; addOnCents: number }, monthsBanked: number) {
  if (monthsBanked < 1) return { dueCents: charge.subscriptionCents + charge.addOnCents, monthsLeft: 0, coveredByRewardMonth: false };
  return { dueCents: charge.addOnCents, monthsLeft: monthsBanked - 1, coveredByRewardMonth: true };
}

// ---------------------------------------------------------------------------
// Tracker view
// ---------------------------------------------------------------------------

export interface RewardsState {
  completed: ReadonlySet<ActivityId>;
  /** Referrals still waiting on the referred household's paid months. */
  pendingReferrals: number;
  /** Free months earned in the last 12 months. */
  monthsEarned12: number;
  /** Free months earned and not yet used on a bill. */
  monthsBanked: number;
}

export function progress(state: RewardsState, config: RewardsConfig = DEFAULT_REWARDS) {
  return {
    starterDone: STARTER_ACTIVITIES.filter((id) => state.completed.has(id)).length,
    starterTotal: STARTER_ACTIVITIES.length,
    completedCount: ACTIVITIES.filter((a) => state.completed.has(a.id)).length,
    monthsLeftThisYear: Math.max(0, config.referralMonthsPerRolling12 - state.monthsEarned12),
  };
}

/**
 * Readli Rewards (Kevin, 2026-10-10). Adults only: shown in onboarding and the Family dashboard,
 * never in Readli Kids. Rewards follow meaningful Readli activity. Social follows, likes and other
 * third-party engagement never earn anything (see Follow Readli's Story).
 *
 * Reward amounts and eligibility are PROPOSED until pricing is final.
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
    detail: "Earns a reward when they start a qualifying subscription.",
    sticker: "Story spreader",
  },
];

export const STARTER_ACTIVITIES: readonly ActivityId[] = ["family_account", "family_library", "invite_storyteller", "first_voice_or_story"];

export interface Reward {
  id: "intro_free_month" | "referral_free_month";
  title: string;
  detail: string;
}

/** Proposed introductory reward. Final amounts follow pricing and eligibility rules. */
export const REWARD_RULES = {
  status: "proposed" as const,
  introFreeMonth: {
    id: "intro_free_month" as const,
    title: "One free month",
    detail: "For an eligible new household that finishes the four starter activities. Applied to their first paid month.",
  },
  referralFreeMonth: {
    id: "referral_free_month" as const,
    title: "One free month",
    detail: "When a household you referred starts a qualifying paid subscription.",
  },
  /** At most this many referral months a year. */
  referralMonthsPerYear: 12,
};

export interface RewardsState {
  completed: ReadonlySet<ActivityId>;
  /** New household that has never had a Readli subscription or the intro month. */
  eligibleNewHousehold: boolean;
  /** Referred households that activated a qualifying subscription in the last 12 months. */
  qualifyingReferrals: number;
}

export function progress(state: RewardsState) {
  const starterDone = STARTER_ACTIVITIES.filter((id) => state.completed.has(id)).length;
  const rewards: Reward[] = [];
  if (state.eligibleNewHousehold && starterDone === STARTER_ACTIVITIES.length) rewards.push(REWARD_RULES.introFreeMonth);
  const referralMonths = Math.min(state.qualifyingReferrals, REWARD_RULES.referralMonthsPerYear);
  for (let i = 0; i < referralMonths; i++) rewards.push(REWARD_RULES.referralFreeMonth);
  return {
    starterDone,
    starterTotal: STARTER_ACTIVITIES.length,
    completedCount: ACTIVITIES.filter((a) => state.completed.has(a.id)).length,
    rewards,
  };
}

/**
 * A referral qualifies only when a different household starts a paid subscription it pays for itself.
 * Gifts and free trials don't count, so nobody can earn a reward by paying for it themselves.
 */
export function referralQualifies(r: { sameHouseholdAsReferrer: boolean; subscription: "paid" | "trial" | "gift" | "none" }): boolean {
  return !r.sameHouseholdAsReferrer && r.subscription === "paid";
}

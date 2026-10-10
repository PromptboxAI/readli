import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  ACTIVITIES,
  applyRewardMonth,
  DEFAULT_REWARDS,
  grantReferralMonth,
  narrationAllowanceSeconds,
  referralStatus,
  rewardsConfig,
  rewardsVisible,
  startTrial,
  trialEligibility,
  type ReferralFacts,
  type RewardMonth,
} from "./rewards";

const ON = { ...DEFAULT_REWARDS, programPublic: true };
const AT = new Date("2027-03-01T00:00:00Z");
const day = (n: number) => new Date(AT.getTime() + n * 86_400_000);

function facts(over: Partial<ReferralFacts> = {}, referred = "hB"): ReferralFacts {
  return {
    referral: { referrerHouseholdId: "hA", referredHouseholdId: referred, attributedAt: day(-90) },
    sharesIdentityWithReferrer: false,
    referredHadFamilyBefore: false,
    earlierReferralExists: false,
    referrerWasReferredByReferred: false,
    successfulPaidCycles: 2,
    ...over,
  };
}

describe("Readli Rewards activities", () => {
  it("are meaningful Readli activities and nothing social", () => {
    expect(ACTIVITIES.map((a) => a.id)).toEqual(["family_account", "family_library", "invite_storyteller", "first_voice_or_story", "referral"]);
    for (const a of ACTIVITIES) expect(`${a.id} ${a.title} ${a.detail}`).not.toMatch(/follow|like|social|share on|instagram|tiktok/i);
  });
});

describe("settings", () => {
  it("default to Kevin's limits with the program off", () => {
    expect(DEFAULT_REWARDS).toEqual({ programPublic: false, trialDays: 14, trialNarrationMinutes: 10, referralPaidCyclesRequired: 2, referralMonthsPerRolling12: 3 });
    expect(rewardsConfig({} as NodeJS.ProcessEnv)).toEqual(DEFAULT_REWARDS);
  });

  it("are adjustable by admin settings", () => {
    const c = rewardsConfig({ REWARDS_PROGRAM_PUBLIC: "true", REWARDS_TRIAL_DAYS: "7", REWARDS_TRIAL_NARRATION_MINUTES: "5", REWARDS_REFERRAL_PAID_CYCLES: "3", REWARDS_REFERRAL_MONTHS_PER_12: "6" } as unknown as NodeJS.ProcessEnv);
    expect(c).toEqual({ programPublic: true, trialDays: 7, trialNarrationMinutes: 5, referralPaidCyclesRequired: 3, referralMonthsPerRolling12: 6 });
    expect(rewardsConfig({ REWARDS_TRIAL_DAYS: "-1", REWARDS_REFERRAL_PAID_CYCLES: "0" } as unknown as NodeJS.ProcessEnv)).toMatchObject({ trialDays: 14, referralPaidCyclesRequired: 1 });
  });

  it("stay hidden in production until the program is public", () => {
    expect(rewardsVisible(DEFAULT_REWARDS, { VERCEL_ENV: "production" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(rewardsVisible(ON, { VERCEL_ENV: "production" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(rewardsVisible(DEFAULT_REWARDS, { VERCEL_ENV: "preview" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("free trial", () => {
  it("gives eligible new households 14 days with a small narration allowance", () => {
    expect(trialEligibility({ adultsHadFamilyBefore: false, sharedSignalUsedForTrial: false }, ON)).toEqual({ eligible: true });
    const t = startTrial(AT, ON);
    expect(t.endsAt).toEqual(day(14));
    expect(t.narrationSeconds).toBe(600);
    expect(narrationAllowanceSeconds({ kind: "trial" }, 30, ON)).toBe(600);
  });

  it("is refused to returning customers, duplicate accounts and while the program is off", () => {
    expect(trialEligibility({ adultsHadFamilyBefore: true, sharedSignalUsedForTrial: false }, ON)).toEqual({ eligible: false, reason: "not_new" });
    expect(trialEligibility({ adultsHadFamilyBefore: false, sharedSignalUsedForTrial: true }, ON)).toEqual({ eligible: false, reason: "duplicate_account" });
    expect(trialEligibility({ adultsHadFamilyBefore: false, sharedSignalUsedForTrial: false }, DEFAULT_REWARDS)).toEqual({ eligible: false, reason: "program_off" });
  });
});

describe("referrals", () => {
  it("qualify only after the referred household's second successful paid month", () => {
    expect(referralStatus(facts({ successfulPaidCycles: 0 }), ON)).toEqual({ status: "pending", cyclesLeft: 2 });
    expect(referralStatus(facts({ successfulPaidCycles: 1 }), ON)).toEqual({ status: "pending", cyclesLeft: 1 });
    expect(referralStatus(facts({ successfulPaidCycles: 2 }), ON)).toEqual({ status: "qualified" });
    expect(grantReferralMonth(facts({ successfulPaidCycles: 1 }), [], AT, ON)).toEqual({ granted: false, reason: "not_qualified" });
    expect(grantReferralMonth(facts(), [], AT, ON)).toEqual({ granted: true, month: { householdId: "hA", referredHouseholdId: "hB", grantedAt: AT } });
  });

  it("block self-referrals, duplicate accounts, existing customers and circular referrals", () => {
    expect(referralStatus(facts({}, "hA"), ON)).toEqual({ status: "rejected", reason: "self_referral" });
    expect(referralStatus(facts({ sharesIdentityWithReferrer: true }), ON)).toEqual({ status: "rejected", reason: "self_referral" });
    expect(referralStatus(facts({ referredHadFamilyBefore: true }), ON)).toEqual({ status: "rejected", reason: "existing_customer" });
    expect(referralStatus(facts({ referrerWasReferredByReferred: true }), ON)).toEqual({ status: "rejected", reason: "circular" });
  });

  it("never stack: one referrer per household and one month per referred household", () => {
    expect(referralStatus(facts({ earlierReferralExists: true }), ON)).toEqual({ status: "rejected", reason: "already_referred" });
    const earned: RewardMonth[] = [{ householdId: "hA", referredHouseholdId: "hB", grantedAt: day(-10) }];
    expect(grantReferralMonth(facts(), earned, AT, ON)).toEqual({ granted: false, reason: "already_rewarded" });
  });

  it("cap at three free months in any rolling 12 months, without banking the overflow", () => {
    const earned: RewardMonth[] = [day(-300), day(-200), day(-100)].map((d, i) => ({ householdId: "hA", referredHouseholdId: `h${i}`, grantedAt: d }));
    expect(grantReferralMonth(facts(), earned, AT, ON)).toEqual({ granted: false, reason: "cap_reached", nextOpening: day(65) });
    expect(grantReferralMonth(facts(), earned, day(66), ON).granted).toBe(true);
  });

  it("earn nothing while the program is off", () => {
    expect(grantReferralMonth(facts(), [], AT, DEFAULT_REWARDS)).toEqual({ granted: false, reason: "program_off" });
  });
});

describe("free months", () => {
  it("waive one subscription charge and nothing else", () => {
    expect(applyRewardMonth({ subscriptionCents: 1499, addOnCents: 299 }, 2)).toEqual({ dueCents: 299, monthsLeft: 1, coveredByRewardMonth: true });
    expect(applyRewardMonth({ subscriptionCents: 1499, addOnCents: 0 }, 0)).toEqual({ dueCents: 1499, monthsLeft: 0, coveredByRewardMonth: false });
  });

  it("don't add a narration allowance on top of the normal monthly one", () => {
    const paid = narrationAllowanceSeconds({ kind: "subscription", coveredByRewardMonth: false }, 30, ON);
    expect(narrationAllowanceSeconds({ kind: "subscription", coveredByRewardMonth: true }, 30, ON)).toBe(paid);
    expect(paid).toBe(1800);
  });
});

function files(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
  } catch {
    return [];
  }
}

describe("adult-only surfaces", () => {
  it("never puts social discovery, rewards or gifting inside Readli Kids", () => {
    // Every Readli Kids surface: /kids, /family/kids, kids APIs and components.
    const kids = files(join(process.cwd(), "src")).filter((f) => /[\\/]kids[\\/]/.test(f));
    expect(kids.length).toBeGreaterThan(0);
    for (const f of kids) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/FollowReadliStory|SOCIAL_ACCOUNTS|components\/rewards|components\/gifting|lib\/rewards|lib\/gifting/);
    }
  });
});

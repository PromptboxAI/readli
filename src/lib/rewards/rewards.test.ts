import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { ACTIVITIES, progress, REWARD_RULES, referralQualifies, STARTER_ACTIVITIES, type ActivityId } from "./rewards";

const state = (done: ActivityId[], over = {}) => ({ completed: new Set(done), eligibleNewHousehold: true, qualifyingReferrals: 0, ...over });

describe("Readli Rewards", () => {
  it("rewards the five meaningful activities and nothing social", () => {
    expect(ACTIVITIES.map((a) => a.id)).toEqual(["family_account", "family_library", "invite_storyteller", "first_voice_or_story", "referral"]);
    for (const a of ACTIVITIES) expect(`${a.id} ${a.title} ${a.detail}`).not.toMatch(/follow|like|social|share on|instagram|tiktok/i);
  });

  it("unlocks the proposed free month once an eligible new household finishes the starter activities", () => {
    expect(REWARD_RULES.status).toBe("proposed");
    expect(progress(state(STARTER_ACTIVITIES.slice(0, 3) as ActivityId[])).rewards).toEqual([]);
    expect(progress(state([...STARTER_ACTIVITIES])).rewards.map((r) => r.id)).toEqual(["intro_free_month"]);
    expect(progress(state([...STARTER_ACTIVITIES], { eligibleNewHousehold: false })).rewards).toEqual([]);
  });

  it("counts referrals only when another household starts paying, capped yearly", () => {
    expect(referralQualifies({ sameHouseholdAsReferrer: false, subscription: "paid" })).toBe(true);
    expect(referralQualifies({ sameHouseholdAsReferrer: true, subscription: "paid" })).toBe(false);
    expect(referralQualifies({ sameHouseholdAsReferrer: false, subscription: "gift" })).toBe(false);
    expect(referralQualifies({ sameHouseholdAsReferrer: false, subscription: "trial" })).toBe(false);
    expect(progress(state([], { qualifyingReferrals: 40 })).rewards).toHaveLength(REWARD_RULES.referralMonthsPerYear);
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
    const kids = [...files(join(process.cwd(), "src/app/kids")), ...files(join(process.cwd(), "src/components/kids"))];
    for (const f of kids) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/FollowReadliStory|SOCIAL_ACCOUNTS|components\/rewards|components\/gifting|lib\/rewards|lib\/gifting/);
    }
  });
});

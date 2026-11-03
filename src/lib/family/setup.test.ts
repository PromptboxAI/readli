import { describe, expect, it } from "vitest";
import { DEMO_HOUSEHOLD_ID, demoFamilyState } from "./demo-family";
import { firstStoryChosen, hasReadingVoice, setupProgress } from "./setup";

describe("getting-started progress", () => {
  it("counts the steps done and names the first one left", () => {
    expect(setupProgress({ voice: false, kids: false, story: false })).toMatchObject({ done: 0, next: "voice" });
    expect(setupProgress({ voice: true, kids: false, story: true })).toMatchObject({ done: 2, next: "kids" });
    expect(setupProgress({ voice: true, kids: true, story: false })).toMatchObject({ done: 2, next: "story" });
    expect(setupProgress({ voice: true, kids: true, story: true })).toMatchObject({ done: 3, next: null });
  });

  it("counts a first story only once one is being prepared or ready, not a failed or canceled one", () => {
    const state = demoFamilyState();
    const mine = state.jobs.filter((j) => j.householdId === DEMO_HOUSEHOLD_ID);
    expect(firstStoryChosen(state, DEMO_HOUSEHOLD_ID)).toBe(mine.some((j) => j.status !== "failed" && j.status !== "canceled"));
    const none = { ...state, jobs: [] };
    expect(firstStoryChosen(none, DEMO_HOUSEHOLD_ID)).toBe(false);
    const failed = { ...state, jobs: state.jobs.slice(0, 1).map((j) => ({ ...j, householdId: DEMO_HOUSEHOLD_ID, status: "failed" as const })) };
    expect(firstStoryChosen(failed, DEMO_HOUSEHOLD_ID)).toBe(false);
  });

  it("counts your own voice, or a ready voice shared with the family", () => {
    const state = demoFamilyState();
    const owner = state.voices.find((v) => v.deletedAt === null)!.ownerId;
    expect(hasReadingVoice(state, owner, DEMO_HOUSEHOLD_ID)).toBe(true);
    expect(hasReadingVoice({ ...state, voices: [] }, owner, DEMO_HOUSEHOLD_ID)).toBe(false);
  });
});

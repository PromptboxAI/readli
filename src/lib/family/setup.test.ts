import { describe, expect, it } from "vitest";
import { DEMO_HOUSEHOLD_ID, demoFamilyState } from "./demo-family";
import { DEFAULT_PLAN } from "./plan";
import { firstStoryChosen, hasReadingVoice, myVoiceForKids, setupProgress, setupStep, stepAfter, stepBefore } from "./setup";

describe("getting-started progress", () => {
  it("counts the steps done and names the first one left", () => {
    expect(setupProgress({ voice: false, kids: false, story: false })).toMatchObject({ done: 0, next: "voice" });
    expect(setupProgress({ voice: true, kids: false, story: true })).toMatchObject({ done: 2, next: "kids" });
    expect(setupProgress({ voice: true, kids: true, story: false })).toMatchObject({ done: 2, next: "story" });
    expect(setupProgress({ voice: true, kids: true, story: true })).toMatchObject({ done: 3, next: null });
    // Inviting family and listening count towards the five, but never hold setup open.
    expect(setupProgress({ voice: true, kids: false, story: false, family: true })).toMatchObject({ done: 2, next: "kids" });
    expect(setupProgress({ voice: true, kids: true, story: true, family: true, listen: true })).toMatchObject({ done: 5, next: null });
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

  it("walks the screens in order: voice, kids, family, book, then done", () => {
    expect(stepAfter("voice")).toBe("kids");
    expect(stepAfter("kids")).toBe("family");
    expect(stepAfter("family")).toBe("book");
    expect(stepAfter("book")).toBe("listen");
    expect(stepAfter("listen")).toBe("done");
    expect(stepBefore("voice")).toBeNull();
    expect(stepBefore("family")).toBe("kids");
    expect(stepBefore("done")).toBe("listen");
  });

  it("opens on the screen asked for, or else the first essential step left", () => {
    const none = setupProgress({ voice: false, kids: false, story: false });
    expect(setupStep(undefined, none)).toBe("voice");
    expect(setupStep("family", none)).toBe("family");
    expect(setupStep("nonsense", none)).toBe("voice");
    expect(setupStep(undefined, setupProgress({ voice: true, kids: false, story: false }))).toBe("kids");
    expect(setupStep(undefined, setupProgress({ voice: true, kids: true, story: false }))).toBe("book");
    expect(setupStep(undefined, setupProgress({ voice: true, kids: true, story: true }))).toBe("done");
  });

  it("knows when your own ready voice already reads to every child", () => {
    const state = demoFamilyState();
    const voice = state.voices.find((v) => v.status === "ready" && v.deletedAt === null)!;
    const mine = myVoiceForKids(state, voice.ownerId, DEMO_HOUSEHOLD_ID, DEFAULT_PLAN);
    expect(mine?.voiceId).toBeDefined();
    expect(myVoiceForKids({ ...state, approvals: [] }, voice.ownerId, DEMO_HOUSEHOLD_ID, DEFAULT_PLAN)?.on).toBe(
      state.children.filter((c) => c.householdId === DEMO_HOUSEHOLD_ID && c.deletedAt === null).length === 0,
    );
    expect(myVoiceForKids({ ...state, voices: [] }, voice.ownerId, DEMO_HOUSEHOLD_ID, DEFAULT_PLAN)).toBeNull();
  });
});

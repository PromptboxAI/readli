import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "./demo-family";
import { isParent, isStorytellerOnly } from "./storyteller";

describe("who belongs on Readli Voice", () => {
  it("keeps parents in Readli Family and sends storytellers to their free Readli Voice home", () => {
    const state = demoFamilyState();
    const parent = state.members.find((m) => m.householdId === DEMO_HOUSEHOLD_ID && m.role === "guardian")!.adultId;
    expect(isParent(state, parent)).toBe(true);
    expect(isStorytellerOnly(state, parent)).toBe(false);

    // Invited and joined, before recording: a storyteller, never a new family.
    state.adults.push({ id: "andrea", displayName: "Andrea", relationship: "", avatarUrl: null, tint: "bg-sky" });
    state.members.push({ householdId: DEMO_HOUSEHOLD_ID, adultId: "andrea", role: "member", joinedAt: "2026-10-22T00:00:00.000Z", removedAt: null });
    expect(isStorytellerOnly(state, "andrea")).toBe(true);

    // A contributor with a voice and no family yet is a storyteller too.
    state.voices.push({ id: "voice-june", ownerId: "june", version: 1, status: "ready", createdAt: "2026-10-22T00:00:00.000Z", deletedAt: null });
    expect(isStorytellerOnly(state, "june")).toBe(true);

    // Someone brand new, with no family and no voice, may be starting a family.
    expect(isStorytellerOnly(state, "nobody")).toBe(false);
    expect(isStorytellerOnly(null, "andrea")).toBe(false);
  });
});

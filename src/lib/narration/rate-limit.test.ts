import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "@/lib/family/demo-family";
import type { FamilyState, NarrationJob } from "@/lib/family/model";
import { GENERATION_LIMITS, generationLimit } from "./narration";

const AT = "2026-10-11T12:00:00.000Z";
const job = (minutesAgo: number, householdId = DEMO_HOUSEHOLD_ID): NarrationJob => ({
  id: `j${Math.random()}`,
  libraryKey: "k",
  householdId,
  requestedBy: "sara",
  scope: "book",
  sentenceIds: [],
  reservations: {},
  status: "done",
  createdAt: new Date(Date.parse(AT) - minutesAgo * 60_000).toISOString(),
  finishedAt: null,
});

function state(trial: boolean, jobs: NarrationJob[]): FamilyState {
  const s = demoFamilyState();
  s.entitlements = [
    { id: "e", householdId: DEMO_HOUSEHOLD_ID, source: "subscription", status: "active", extraNarratorSlots: 0, extraStreams: 0, startsAt: "2026-10-01T00:00:00Z", endsAt: null, trialEndsAt: trial ? "2026-10-15T00:00:00Z" : null },
  ];
  s.jobs = jobs;
  return s;
}

describe("generation rate limits", () => {
  it("caps requests per hour, more tightly during the free trial", () => {
    const many = (n: number) => Array.from({ length: n }, () => job(10));
    expect(generationLimit(state(false, many(GENERATION_LIMITS.perHour - 1)), DEMO_HOUSEHOLD_ID, AT)).toBeNull();
    expect(generationLimit(state(false, many(GENERATION_LIMITS.perHour)), DEMO_HOUSEHOLD_ID, AT)).toMatchObject({ code: "rate_limited" });
    expect(generationLimit(state(true, many(GENERATION_LIMITS.trialPerHour)), DEMO_HOUSEHOLD_ID, AT)).toMatchObject({ code: "rate_limited" });
    expect(generationLimit(state(true, Array.from({ length: GENERATION_LIMITS.trialPerDay }, (_, i) => job(120 + i))), DEMO_HOUSEHOLD_ID, AT)).toMatchObject({ code: "trial_rate_limited" });
  });

  it("counts only this household's recent requests", () => {
    const old = Array.from({ length: 30 }, () => job(90));
    const others = Array.from({ length: 30 }, () => job(5, "someone-else"));
    expect(generationLimit(state(false, [...old, ...others]), DEMO_HOUSEHOLD_ID, AT)).toBeNull();
  });
});

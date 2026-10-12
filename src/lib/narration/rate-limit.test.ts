import { describe, expect, it } from "vitest";
import { demoFamilyState, DEMO_HOUSEHOLD_ID } from "@/lib/family/demo-family";
import type { CreditEntry, FamilyState, NarrationJob } from "@/lib/family/model";
import { DEFAULT_GENERATION_LIMITS as L } from "@/lib/family/plan";
import { generationLimit } from "./narration";

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

const reserve = (credits: number, minutesAgo: number, kind: CreditEntry["kind"] = "reserve"): CreditEntry => ({
  id: `l${Math.random()}`,
  householdId: DEMO_HOUSEHOLD_ID,
  lotId: "lot",
  kind,
  credits,
  jobId: null,
  sentenceId: null,
  at: new Date(Date.parse(AT) - minutesAgo * 60_000).toISOString(),
});

function state(trial: boolean, jobs: NarrationJob[], ledger: CreditEntry[] = []): FamilyState {
  const s = demoFamilyState();
  s.entitlements = [
    { id: "e", householdId: DEMO_HOUSEHOLD_ID, source: "subscription", status: "active", extraNarratorSlots: 0, extraStreams: 0, startsAt: "2026-10-01T00:00:00Z", endsAt: null, trialEndsAt: trial ? "2026-10-15T00:00:00Z" : null },
  ];
  s.jobs = jobs;
  s.ledger = ledger;
  return s;
}

describe("generation limits", () => {
  const check = (st: FamilyState, chars = 500) => generationLimit(st, L, DEMO_HOUSEHOLD_ID, AT, chars);

  it("keeps Kevin's provisional request caps: 20 an hour paid; 5 an hour and 10 a day in a trial", () => {
    expect(L).toMatchObject({ requestsPerHour: 20, trialRequestsPerHour: 5, trialRequestsPerDay: 10 });
    const many = (n: number) => Array.from({ length: n }, () => job(10));
    expect(check(state(false, many(L.requestsPerHour - 1)))).toBeNull();
    expect(check(state(false, many(L.requestsPerHour)))).toMatchObject({ code: "rate_limited", status: 429 });
    expect(check(state(true, many(L.trialRequestsPerHour)))).toMatchObject({ code: "rate_limited" });
    expect(check(state(true, Array.from({ length: L.trialRequestsPerDay }, (_, i) => job(120 + i))))).toMatchObject({ code: "trial_rate_limited" });
  });

  it("counts only this household's recent requests", () => {
    const old = Array.from({ length: 30 }, () => job(90));
    const others = Array.from({ length: 30 }, () => job(5, "someone-else"));
    expect(check(state(false, [...old, ...others]))).toBeNull();
  });

  it("refuses an oversized request, and too many preparations at once", () => {
    expect(check(state(false, []), L.maxRequestCharacters + 1)).toMatchObject({ code: "request_too_large", status: 413 });
    const running = (n: number) => Array.from({ length: n }, () => ({ ...job(90), status: "running" as const }));
    expect(check(state(false, running(L.maxConcurrentJobs - 1)))).toBeNull();
    expect(check(state(false, running(L.maxConcurrentJobs)))).toMatchObject({ code: "too_many_at_once" });
    expect(check(state(true, running(L.trialMaxConcurrentJobs)))).toMatchObject({ code: "too_many_at_once" });
  });

  it("caps characters per day, with refunded characters given back", () => {
    expect(check(state(false, [], [reserve(L.charactersPerDay - 1000, 60)]), 1000)).toBeNull();
    expect(check(state(false, [], [reserve(L.charactersPerDay - 1000, 60)]), 1001)).toMatchObject({ code: "daily_characters" });
    expect(check(state(false, [], [reserve(L.charactersPerDay, 60), reserve(5000, 30, "refund")]), 5000)).toBeNull();
    expect(check(state(false, [], [reserve(L.charactersPerDay, 60 * 25)]), 5000)).toBeNull();
    expect(check(state(true, [], [reserve(L.trialCharactersPerDay, 60)]), 1)).toMatchObject({ code: "daily_characters" });
  });

  it("uses the limits it is given, so an admin can tune them", () => {
    expect(generationLimit(state(false, [job(1)]), { ...L, requestsPerHour: 1 }, DEMO_HOUSEHOLD_ID, AT, 10)).toMatchObject({ code: "rate_limited" });
  });
});

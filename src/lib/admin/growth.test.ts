import { describe, expect, it } from "vitest";
import { addMonths, growthReport, type GrowthInputs } from "./growth";

const at = new Date("2026-11-05T12:00:00Z");
const ago = (d: number) => new Date(at.getTime() - d * 86_400_000).toISOString();

function input(over: Partial<GrowthInputs> = {}): GrowthInputs {
  return { at, households: [], entitlements: [], revenue: [], acquisition: [], referrals: [], invitations: [], shares: [], cancellations: [], sessions: [], timeZones: new Map(), ...over };
}

/** Monthly paid periods for a family, starting `startDaysAgo` and lasting `months`. */
function paid(household_id: string, startDaysAgo: number, months: number) {
  const start = Date.parse(ago(startDaysAgo));
  return Array.from({ length: months }, (_, i) => ({
    household_id,
    kind: "subscription",
    amount_cents: 1999,
    period_start: new Date(addMonths(start, i)).toISOString(),
    period_end: new Date(addMonths(start, i + 1)).toISOString(),
    occurred_at: new Date(addMonths(start, i)).toISOString(),
  }));
}

describe("addMonths", () => {
  it("clamps to the end of a shorter month", () => {
    expect(new Date(addMonths(Date.parse("2026-01-31T00:00:00Z"), 1)).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});

describe("growthReport", () => {
  it("measures retention from each family's first payment, split by voices", () => {
    const r = growthReport(
      input({
        revenue: [...paid("stay", 200, 7), ...paid("leave", 200, 2), ...paid("new", 10, 1), { household_id: "gift", kind: "gift", amount_cents: 5000, occurred_at: ago(100) }],
        shares: [
          { household_id: "stay", voice_id: "v1" },
          { household_id: "stay", voice_id: "v2" },
          { household_id: "leave", voice_id: "v1" },
        ],
      }),
    );
    const [all, few, many] = r.segments;
    expect(all).toMatchObject({ families: 3, m1: 1, m3: 0.5, m6: 0.5 });
    expect(few).toMatchObject({ families: 2, m1: 1, m3: 0 });
    expect(many).toMatchObject({ families: 1, m3: 1, m6: 1 });
    const cohort = r.cohorts.find((c) => c.families === 2)!;
    expect(cohort.retained.slice(0, 3)).toEqual([1, 0.5, 0.5]);
    expect(r.cohorts.find((c) => c.families === 1)!.retained).toEqual([null, null, null, null, null, null]);
  });

  it("assigns each family one channel", () => {
    const r = growthReport(
      input({
        households: [
          { id: "ref", created_at: ago(5) },
          { id: "inv", created_at: ago(5) },
          { id: "ads", created_at: ago(5) },
          { id: "old", created_at: ago(400) },
        ],
        referrals: [{ referred_household_id: "ref", rejected_reason: null }],
        invitations: [{ household_id: "inv", accepted_at: ago(5) }],
        acquisition: [{ household_id: "ads", click_id: "gclid" }, { household_id: "inv" }],
        revenue: paid("ads", 4, 1),
      }),
    );
    const by = Object.fromEntries(r.channels.map((c) => [c.channel, c]));
    expect(by.referral).toMatchObject({ started: 1, startedAndPaid: 0 });
    expect(by.storyteller_invite).toMatchObject({ started: 1 });
    expect(by.paid).toMatchObject({ started: 1, startedAndPaid: 1, payingEver: 1 });
    expect(by.unknown).toBeUndefined();
    expect(r.trackedFamilies).toBe(2);
  });

  it("separates failed payments from families who chose to leave", () => {
    const r = growthReport(
      input({
        cancellations: [
          { reason: "cancellation_requested", feedback: "too_expensive", comment: "Money is tight", requested_at: ago(3), withdrawn_at: null },
          { reason: "cancellation_requested", feedback: null, comment: null, requested_at: ago(10), withdrawn_at: ago(9) },
          { reason: "payment_failed", feedback: null, comment: null, requested_at: ago(20), withdrawn_at: null },
          { reason: "cancellation_requested", feedback: "unused", comment: null, requested_at: ago(200), withdrawn_at: null },
        ],
      }),
    );
    expect(r.cancels).toMatchObject({ total: 3, voluntary: 2, involuntary: 1, withdrawn: 1 });
    expect(r.cancels.byFeedback).toEqual([
      { feedback: "too_expensive", count: 1 },
      { feedback: "not_answered", count: 1 },
    ]);
    expect(r.cancels.recentComments).toEqual([{ at: ago(3), feedback: "too_expensive", comment: "Money is tight" }]);
  });

  it("counts listening days per child and bedtime in the family's time zone", () => {
    const monday = "2026-11-02";
    const r = growthReport(
      input({
        revenue: paid("h1", 40, 3),
        sessions: [
          { household_id: "h1", child_id: "c1", started_at: `${monday}T01:00:00Z` },
          { household_id: "h1", child_id: "c1", started_at: `${monday}T02:00:00Z` },
          { household_id: "h1", child_id: "c1", started_at: "2026-11-04T01:30:00Z" },
          { household_id: "h1", child_id: "c2", started_at: "2026-11-04T15:00:00Z" },
        ],
        timeZones: new Map([["h1", "America/New_York"]]),
      }),
    );
    const week = r.weeks.at(-1)!;
    expect(week).toMatchObject({ weekOf: monday, activeChildren: 2, activeFamilies: 1, daysPerChild: 1.5, bedtimeShare: 0.75 });
    expect(r.weeks).toHaveLength(8);
    expect(r.payingActive7d).toEqual({ active: 1, paying: 1, rate: 1 });
  });
});

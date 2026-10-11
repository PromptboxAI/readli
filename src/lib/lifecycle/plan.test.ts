// @vitest-environment node
import { describe, expect, it } from "vitest";
import { recoveryEmail } from "./notices";
import { DEFAULT_LIFECYCLE, dueNotice, planLifecycleRun, type LifecycleSnapshot, type SnapEntitlement, type SnapRecovery } from "./plan";

const DAY = 86_400_000;
const T0 = Date.parse("2026-11-01T06:00:00Z");
const iso = (t: number) => new Date(t).toISOString();

function ent(householdId: string, over: Partial<SnapEntitlement> = {}): SnapEntitlement {
  return { householdId, source: "subscription", status: "active", tier: "family", startsAt: iso(T0 - 200 * DAY), endsAt: null, updatedAt: iso(T0 - 100 * DAY), ...over };
}

function ended(householdId: string, endedAt: number): SnapEntitlement {
  return ent(householdId, { status: "canceled", endsAt: iso(endedAt), updatedAt: iso(endedAt) });
}

function recovering(householdId: string, endedAt: number, notices: SnapRecovery["notices"] = {}): SnapRecovery {
  return { householdId, accessEndedAt: iso(endedAt), deletionDueAt: iso(endedAt + 30 * DAY), status: "recovering", notices };
}

function snap(now: number, over: Partial<LifecycleSnapshot> = {}): LifecycleSnapshot {
  return { now: iso(now), entitlements: [], recoveries: [], shares: [], libraries: [], voices: [], billingLive: [], billingUnknown: [], ...over };
}

/** A household whose window ran out, with every reminder sent on time. */
function dueForDeletion(householdId: string, endedAt: number): SnapRecovery {
  const due = endedAt + 30 * DAY;
  return recovering(householdId, endedAt, { day0: iso(endedAt), day21: iso(due - 9 * DAY), day28: iso(due - 2 * DAY), day30: iso(due) });
}

const kinds = (s: LifecycleSnapshot) => planLifecycleRun(s).actions.map((a) => `${a.kind}:${"householdId" in a ? a.householdId : a.voiceId}`);

describe("the 30-day recovery window", () => {
  it("opens when paid access ends, with the Day 0 email naming both dates", () => {
    const end = T0 - 3600_000;
    const { actions } = planLifecycleRun(snap(T0, { entitlements: [ended("h1", end), ent("h2")] }));
    expect(actions).toEqual([
      { kind: "start_recovery", householdId: "h1", accessEndedAt: iso(end), deletionDueAt: iso(end + 30 * DAY) },
      { kind: "notice", householdId: "h1", notice: "day0", skipped: [], accessEndedAt: iso(end), deletionDueAt: iso(end + 30 * DAY) },
    ]);
    const email = recoveryEmail("day0", {
      familyName: "Rivera",
      endedAt: iso(end),
      deletesAt: iso(end + 30 * DAY),
      familyMonthlyPriceCents: 1999,
      archiveMonthlyPriceCents: 699,
      billingUrl: "https://readli.ai/family/billing",
      daysLeft: 30,
    });
    expect(email.body).toContain("Sunday, November 1, 2026");
    expect(email.body).toContain("Tuesday, December 1, 2026");
    expect(email.body).toContain("$6.99");
  });

  it("gives at least ten days' warning when the end is found late", () => {
    const end = T0 - 28 * DAY;
    const start = planLifecycleRun(snap(T0, { entitlements: [ended("h1", end)] })).actions[0];
    expect(start).toMatchObject({ kind: "start_recovery", deletionDueAt: iso(T0 + 10 * DAY) });
  });

  it("sends the nine-days, two-days and Day 30 emails on time, each once", () => {
    const end = T0;
    const due = end + 30 * DAY;
    const r = recovering("h1", end, { day0: iso(end) });
    expect(dueNotice(r, end + 10 * DAY)).toBeNull();
    expect(dueNotice(r, due - 9 * DAY)).toEqual({ notice: "day21", skipped: [] });
    r.notices.day21 = iso(due - 9 * DAY);
    expect(dueNotice(r, due - 5 * DAY)).toBeNull();
    expect(dueNotice(r, due - 2 * DAY)).toEqual({ notice: "day28", skipped: [] });
    r.notices.day28 = iso(due - 2 * DAY);
    expect(dueNotice(r, due - 1)).toBeNull();
    expect(dueNotice(r, due)).toEqual({ notice: "day30", skipped: [] });
    r.notices.day30 = iso(due);
    expect(dueNotice(r, due + DAY)).toBeNull();
    const words = (daysLeft: number) => recoveryEmail("day21", { familyName: "R", endedAt: iso(end), deletesAt: iso(due), familyMonthlyPriceCents: 1999, archiveMonthlyPriceCents: 699, billingUrl: "x", daysLeft });
    expect(words(9).subject).toBe("Nine days left to keep your Readli stories");
    expect(recoveryEmail("day28", { familyName: "R", endedAt: iso(end), deletesAt: iso(due), familyMonthlyPriceCents: 1999, archiveMonthlyPriceCents: 699, billingUrl: "x", daysLeft: 2 }).subject).toBe(
      "Final reminder: two days left to keep your Readli stories",
    );
  });

  it("never skips the final reminder: a late one moves the deletion date", () => {
    const end = T0 - 30 * DAY;
    const r = recovering("h1", end, { day0: iso(end) });
    const late = dueNotice(r, T0 + 3600_000);
    expect(late).toEqual({ notice: "day28", skipped: ["day21"], newDeletionDueAt: iso(T0 + 3600_000 + 2 * DAY) });
  });

  it("restores a family that comes back on either plan", () => {
    const end = T0 - 5 * DAY;
    const s = snap(T0, { entitlements: [ended("h1", end), ent("h1", { tier: "archive", startsAt: iso(T0 - DAY) })], recoveries: [recovering("h1", end, { day0: iso(end) })] });
    expect(planLifecycleRun(s).actions).toEqual([{ kind: "restore", householdId: "h1", tier: "archive" }]);
  });

  it("opens a new window if a restored family's plan ends again", () => {
    const first = T0 - 100 * DAY;
    const second = T0 - DAY;
    const s = snap(T0, {
      entitlements: [ended("h1", first), ended("h1", second)],
      recoveries: [{ ...recovering("h1", first), status: "restored" }],
    });
    expect(kinds(s)).toEqual(["start_recovery:h1", "notice:h1"]);
  });
});

describe("Day-30 deletion safeguards", () => {
  const end = T0 - 31 * DAY;

  it("deletes the family's own narration once every reminder has gone out", () => {
    const s = snap(T0, {
      entitlements: [ended("h1", end)],
      recoveries: [dueForDeletion("h1", end)],
      libraries: [
        { key: "own", voiceId: "v1", scope: "h1" },
        { key: "other", voiceId: "v1", scope: "h2" },
      ],
    });
    expect(planLifecycleRun(s).actions).toEqual([{ kind: "delete_household_narration", householdId: "h1", libraryKeys: ["own"], keptShared: 0 }]);
  });

  it("keeps shared narration another paying or recovering household can still play", () => {
    const s = snap(T0, {
      entitlements: [ended("h1", end), ent("h2", { tier: "archive" }), ended("h3", end)],
      recoveries: [dueForDeletion("h1", end), dueForDeletion("h3", end)],
      shares: [
        { voiceId: "grandma", householdId: "h1" },
        { voiceId: "grandma", householdId: "h2" },
        { voiceId: "uncle", householdId: "h1" },
        { voiceId: "uncle", householdId: "h3" },
      ],
      libraries: [
        { key: "grandma-book", voiceId: "grandma", scope: "shared" },
        { key: "uncle-book", voiceId: "uncle", scope: "shared" },
      ],
    });
    const del = planLifecycleRun(s, { ...DEFAULT_LIFECYCLE, brakeMaxFraction: 1 }).actions.filter((a) => a.kind === "delete_household_narration");
    // Grandma's book stays for the Archive family; the uncle's goes only because both his families are deleted.
    expect(del).toEqual([
      { kind: "delete_household_narration", householdId: "h1", libraryKeys: ["uncle-book"], keptShared: 1 },
      { kind: "delete_household_narration", householdId: "h3", libraryKeys: ["uncle-book"], keptShared: 0 },
    ]);
  });

  it("holds when billing still shows a live subscription, and skips when billing can't be checked", () => {
    const s = snap(T0, {
      entitlements: [ended("h1", end), ended("h2", end)],
      recoveries: [dueForDeletion("h1", end), dueForDeletion("h2", end)],
      billingLive: ["h1"],
      billingUnknown: ["h2"],
    });
    expect(planLifecycleRun(s).actions).toEqual([
      { kind: "hold", householdId: "h1", reason: "billing_shows_live_subscription" },
      { kind: "defer", householdId: "h2", reason: "billing_check_failed" },
    ]);
  });

  it("waits after the Day 30 email and after any recent plan change", () => {
    const fresh = { ...dueForDeletion("h1", end), notices: { ...dueForDeletion("h1", end).notices, day30: iso(T0 - 3600_000) } };
    expect(planLifecycleRun(snap(T0, { entitlements: [ended("h1", end)], recoveries: [fresh] })).actions).toEqual([
      { kind: "defer", householdId: "h1", reason: "final_notice_too_recent" },
    ]);
    const changed = ent("h1", { status: "canceled", endsAt: iso(end), updatedAt: iso(T0 - DAY) });
    expect(planLifecycleRun(snap(T0, { entitlements: [changed], recoveries: [dueForDeletion("h1", end)] })).actions).toEqual([
      { kind: "defer", householdId: "h1", reason: "plan_changed_recently" },
    ]);
  });

  it("stops every deletion when a run would delete too many families at once", () => {
    const ids = Array.from({ length: 5 }, (_, i) => `h${i}`);
    const s = snap(T0, { entitlements: [...ids.map((h) => ended(h, end)), ...Array.from({ length: 10 }, (_, i) => ent(`p${i}`))], recoveries: ids.map((h) => dueForDeletion(h, end)) });
    const plan = planLifecycleRun(s);
    expect(plan.brake).toEqual({ wouldDelete: 5, households: 15 });
    expect(plan.actions.every((a) => a.kind === "defer" && a.reason === "mass_deletion_brake")).toBe(true);
  });
});

describe("clone retirement", () => {
  it("marks voices no Family household uses, retires them after the wait, and relinks", () => {
    const old = iso(T0 - 31 * DAY);
    const s = snap(T0, {
      entitlements: [ent("family"), ent("archive", { tier: "archive" })],
      shares: [
        { voiceId: "used", householdId: "family" },
        { voiceId: "archive-only", householdId: "archive" },
        { voiceId: "back", householdId: "family" },
      ],
      voices: [
        { id: "used", status: "ready", hasClone: true, unlinkedSince: null },
        { id: "archive-only", status: "ready", hasClone: true, unlinkedSince: null },
        { id: "idle", status: "ready", hasClone: true, unlinkedSince: old },
        { id: "recent", status: "ready", hasClone: true, unlinkedSince: iso(T0 - 5 * DAY) },
        { id: "back", status: "ready", hasClone: false, unlinkedSince: old },
      ],
    });
    expect(kinds(s)).toEqual(["unlink_voice:archive-only", "retire_clone:idle", "relink_voice:back"]);
  });
});

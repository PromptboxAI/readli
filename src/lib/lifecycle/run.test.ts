// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { fakeSupabase } from "@/lib/testing/fake-supabase";
import { runLifecycle, type LifecycleDeps } from "./run";

/**
 * The daily run against an in-memory database: dry run by default, the Day-30 cleanup scope when
 * switched on, recording deletion, the purchased-credit exception, emails, and the one-run lock.
 */
const DAY = 86_400_000;
const NOW = new Date("2026-12-15T06:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

function world() {
  const ended = ago(40);
  const due = ago(10);
  return fakeSupabase(
    {
      households: [
        { id: "h1", name: "The Riveras" },
        { id: "h2", name: "The Kims" },
      ],
      household_members: [
        { household_id: "h1", user_id: "sara", role: "guardian", removed_at: null },
        { household_id: "h1", user_id: "gran", role: "member", removed_at: null },
        { household_id: "h2", user_id: "gran", role: "member", removed_at: null },
        { household_id: "h2", user_id: "kim", role: "guardian", removed_at: null },
      ],
      household_entitlements: [
        { id: "e1", household_id: "h1", source: "subscription", status: "canceled", tier: "family", starts_at: ago(200), ends_at: ended, updated_at: ended },
        { id: "e2", household_id: "h2", source: "subscription", status: "active", tier: "archive", starts_at: ago(200), ends_at: null, updated_at: ago(100) },
      ],
      household_recovery: [{ household_id: "h1", access_ended_at: ended, deletion_due_at: due, status: "recovering", notices: { day0: ended, day20: ago(20), day28: ago(12) } }],
      voice_profiles: [
        { id: "v-sara", owner_id: "sara", status: "ready", provider_voice_id_encrypted: null, unlinked_since: ago(60) },
        { id: "v-gran", owner_id: "gran", status: "ready", provider_voice_id_encrypted: null, unlinked_since: ago(60) },
      ],
      voice_household_shares: [
        { id: "s1", voice_id: "v-gran", household_id: "h1", revoked_at: null },
        { id: "s2", voice_id: "v-gran", household_id: "h2", revoked_at: null },
        { id: "s3", voice_id: "v-sara", household_id: "h1", revoked_at: null },
      ],
      narration_libraries: [
        { key: "h1-sara", voice_id: "v-sara", scope: "h1" },
        { key: "gran-shared", voice_id: "v-gran", scope: "shared" },
      ],
      narration_segments: [
        { library_key: "h1-sara", storage_key: "h1-sara/0.mp3" },
        { library_key: "gran-shared", storage_key: "gran/0.mp3" },
      ],
      narration_jobs: [],
      child_profiles: [{ id: "maya", household_id: "h1" }],
      narration_assets: [],
      listening_sessions: [{ id: "ls1", household_id: "h1", child_id: "maya" }],
      narration_plays: [{ id: "p1", household_id: "h1", child_id: "maya" }],
      family_notifications: [{ id: "n1", household_id: "h1" }],
      household_invitations: [
        { id: "i1", household_id: "h1", accepted_at: null },
        { id: "i2", household_id: "h1", accepted_at: ago(90) },
      ],
      voice_rights_current: [
        { contributor_id: "sara", readli_development_rights: false },
        { contributor_id: "gran", readli_development_rights: false },
      ],
      voice_training_sessions: [
        { id: "rec-sara", owner_id: "sara", voice_profile_id: "v-sara", recording_deleted_at: null },
        { id: "rec-gran", owner_id: "gran", voice_profile_id: "v-gran", recording_deleted_at: null },
      ],
      voice_training_segments: [
        { session_id: "rec-sara", storage_key: "sara/take.webm" },
        { session_id: "rec-gran", storage_key: "gran/take.webm" },
      ],
      narration_credit_lots: [{ id: "lot1", household_id: "h1", source: "purchased", credits: 20, granted_at: "2026-09-01T00:00:00Z", payment_ref: "pi_1" }],
      revenue_events: [{ provider_ref: "pi_1", kind: "credit_pack", amount_cents: 699 }],
      narration_credit_ledger: [{ household_id: "h1", lot_id: "lot1", kind: "reserve", credits: 5 }],
      billing_customers: [{ household_id: "h1", customer_ref: "cus_1" }],
      adult_profiles: [],
      voice_recording_deletions: [],
      lifecycle_runs: [],
    },
    { unique: { lifecycle_runs: ["status=running"] } },
  );
}

const deps = (db: LifecycleDeps["db"], over: Partial<LifecycleDeps> = {}): LifecycleDeps => ({
  db,
  subscriptionStatuses: async () => ["canceled"],
  retireClone: null,
  billingUrl: "https://readli.ai/family/billing",
  deletion: false,
  cloneRetirement: false,
  recordingDeletion: false,
  plan: DEFAULT_PLAN,
  now: () => NOW,
  ...over,
});

describe("the daily lifecycle run", () => {
  it("is a dry run until switched on, and records the run", async () => {
    const { db, tables, removed } = world();
    const report = await runLifecycle(deps(db));
    expect(report.counts).toMatchObject({ cleanup_dry_run: 1 });
    expect(report.errors).toEqual([]);
    expect(removed).toEqual({});
    expect(tables.child_profiles).toHaveLength(1);
    expect(tables.lifecycle_runs).toEqual([expect.objectContaining({ status: "succeeded", deletion_enabled: false })]);
    expect(tables.lifecycle_audit_log!.find((x) => x.action === "household_cleaned")).toMatchObject({ dry_run: true });
  });

  it("cleans up only what the household alone needed, keeps money records, and confirms by email", async () => {
    const { db, tables, removed } = world();
    let sent = 0;
    const report = await runLifecycle(deps(db, { deletion: true, recordingDeletion: true, sendEmails: async () => ((sent += 1), null) }));
    expect(report.errors).toEqual([]);
    expect(report.counts).toMatchObject({ household_cleaned: 1, recordings_deleted: 1 });
    // Sara's own story and recording go; Grandma's shared story and recording stay for the Kims' Archive.
    expect(removed.narrations).toEqual(["h1-sara/0.mp3"]);
    expect(removed["voice-recordings"]).toEqual(["sara/take.webm"]);
    expect(tables.narration_segments!.map((x) => x.library_key)).toEqual(["gran-shared"]);
    expect(tables.voice_training_sessions!.find((x) => x.id === "rec-gran")).toMatchObject({ recording_deleted_at: null });
    expect(tables.child_profiles).toEqual([]);
    expect(tables.listening_sessions).toEqual([]);
    expect(tables.family_notifications).toEqual([]);
    expect(tables.household_invitations!.map((x) => x.id)).toEqual(["i2"]);
    expect(tables.households!.find((h) => h.id === "h1")!.cleaned_at).toBe(NOW.toISOString());
    expect(tables.household_entitlements).toHaveLength(2);
    expect(tables.narration_credit_lots).toHaveLength(1);
    expect(tables.lifecycle_exceptions).toEqual([expect.objectContaining({ kind: "purchased_credits_unreconciled", household_id: "h1", detail: expect.objectContaining({ credits: 15, unused_value_cents: 524 }) })]);
    expect(tables.household_recovery![0]).toMatchObject({ status: "deleted" });
    expect(tables.email_outbox).toEqual([expect.objectContaining({ template: "household_deleted", recipient_user_id: "sara" })]);
    expect(sent).toBe(1);
  });

  it("is safe to run again, and doesn't open a second exception", async () => {
    const { db, tables } = world();
    await runLifecycle(deps(db, { deletion: true, recordingDeletion: true }));
    const again = await runLifecycle(deps(db, { deletion: true, recordingDeletion: true, now: () => new Date(NOW.getTime() + DAY) }));
    expect(again.errors).toEqual([]);
    expect(tables.lifecycle_exceptions).toHaveLength(1);
    expect(tables.email_outbox).toHaveLength(1);
    expect(tables.lifecycle_runs!.map((r) => r.status)).toEqual(["succeeded", "succeeded"]);
  });

  it("holds when Stripe still shows a live subscription", async () => {
    const { db, tables } = world();
    const report = await runLifecycle(deps(db, { deletion: true, subscriptionStatuses: async () => ["past_due"] }));
    expect(report.counts).toMatchObject({ recovery_held: 1 });
    expect(tables.child_profiles).toHaveLength(1);
  });

  it("never runs twice at once, and clears a run that died hours ago", async () => {
    const { db, tables } = world();
    tables.lifecycle_runs!.push({ id: "old", status: "running", started_at: new Date(NOW.getTime() - 60_000).toISOString() });
    expect(await runLifecycle(deps(db))).toMatchObject({ skipped: "already_running" });
    tables.lifecycle_runs![0]!.started_at = new Date(NOW.getTime() - 3 * 3_600_000).toISOString();
    const report = await runLifecycle(deps(db));
    expect(report.skipped).toBeUndefined();
    expect(tables.lifecycle_runs!.map((r) => r.status)).toEqual(["abandoned", "succeeded"]);
  });

  it("flags a recording deletion that is overdue while deletion is switched off", async () => {
    const { db, tables } = world();
    tables.voice_recording_deletions!.push({ id: "d1", owner_id: "gran", voice_id: null, reason: "owner_request", status: "pending", due_at: ago(1), attempts: 0 });
    await runLifecycle(deps(db));
    expect(tables.voice_recording_deletions![0]).toMatchObject({ status: "pending" });
    expect(tables.lifecycle_exceptions).toEqual([expect.objectContaining({ kind: "recording_deletion_overdue" })]);
  });
});

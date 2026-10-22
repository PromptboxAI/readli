// @vitest-environment node
import { describe, expect, it } from "vitest";
import { costConfig } from "./finance";
import { metricsCsv, voiceMetrics, type VoiceMetricsInput } from "./voice-metrics";

const at = new Date("2026-11-01T00:00:00Z");
const ago = (d: number) => new Date(at.getTime() - d * 86_400_000).toISOString();
const plan = (household_id: string, tier: string) => ({ household_id, status: "active", tier, starts_at: ago(100), ends_at: null });

function input(over: Partial<VoiceMetricsInput> = {}): VoiceMetricsInput {
  return {
    at,
    voices: [
      { id: "grandma", owner_id: "u1", status: "ready", version: 2, provider_voice_id_encrypted: "enc", unlinked_since: null },
      { id: "uncle", owner_id: "u2", status: "ready", version: 1, provider_voice_id_encrypted: "enc", unlinked_since: ago(25) },
      { id: "aunt", owner_id: "u3", status: "withdrawn", version: 1, provider_voice_id_encrypted: null, unlinked_since: null },
    ],
    entitlements: [plan("h1", "family"), plan("h2", "archive"), plan("h3", "archive")],
    shares: [
      { voice_id: "grandma", household_id: "h1" },
      { voice_id: "grandma", household_id: "h2" },
      { voice_id: "uncle", household_id: "h3" },
      { voice_id: "aunt", household_id: "h2" },
    ],
    libraries: [
      { key: "l1", voice_id: "grandma", book_slug: "moon" },
      { key: "l2", voice_id: "aunt", book_slug: "moon" },
    ],
    readySegments: [
      { library_key: "l1", duration_ms: 1_800_000 },
      { library_key: "l2", duration_ms: 1_800_000 },
    ],
    recordings: [{ voice_profile_id: "grandma", duration_ms: 3_600_000 }],
    usable: [
      { contributor_id: "u1", duration_ms: 3_600_000, readli_development_rights: true, third_party_licensing: false },
      { contributor_id: "u2", duration_ms: 1_800_000, readli_development_rights: true, third_party_licensing: true },
    ],
    agreements: [
      { contributor_id: "u1", event: "accepted", service_rights: true, adult_owner_declared: true },
      { contributor_id: "u2", event: "accepted", service_rights: true, adult_owner_declared: true },
      { contributor_id: "u3", event: "withdrawn", service_rights: false, adult_owner_declared: true },
    ],
    events: [
      { action: "plan_changed", at: ago(3), dry_run: false, detail: { from: "family", to: "archive" } },
      { action: "plan_changed", at: ago(2), dry_run: false, detail: { from: "archive", to: "family" } },
      { action: "clone_retired", at: ago(1), dry_run: true, detail: {} },
      { action: "voice_withdrawn", at: ago(1), dry_run: false, detail: {} },
    ],
    recoveries: [
      { status: "restored", restored_tier: "archive", deletion_due_at: ago(-10) },
      { status: "recovering", restored_tier: null, deletion_due_at: ago(-10) },
    ],
    revenue: [{ household_id: "h2", kind: "subscription", amount_cents: 699, billing_interval: "month", period_start: ago(10), period_end: ago(-20) }],
    usage: [],
    costs: costConfig({} as NodeJS.ProcessEnv),
    providerVoiceLimit: 30,
    cloneRetireAfterDays: 30,
    ...over,
  };
}

describe("voice lifecycle metrics", () => {
  const { metrics, voices } = voiceMetrics(input());
  const v = (key: string) => metrics.find((m) => m.key === key)?.value;

  it("counts contributors, clones, links and training rights from the rows", () => {
    expect(v("verified_contributors")).toBe(2);
    expect(v("active_clones")).toBe(2);
    expect(v("voices_family_linked")).toBe(1);
    expect(v("voices_archive_only")).toBe(2);
    expect(v("unlinked_nearing_retirement")).toBe(1);
    expect(v("avg_paying_households_per_voice")).toBe(1.33);
    expect(v("stored_books")).toBe(2);
    expect(v("stored_narration_hours")).toBe(1);
    expect(v("internal_training_hours")).toBe(1.5);
    expect(v("third_party_hours")).toBe(0.5);
    expect(v("provider_clone_headroom")).toBe(28);
  });

  it("reads plan moves, recovery and withdrawals from the lifecycle log, ignoring dry runs", () => {
    expect(v("family_to_archive_30d")).toBe(1);
    expect(v("archive_to_family_30d")).toBe(1);
    expect(v("archive_mrr_cents")).toBe(699);
    expect(v("clone_retired_30d")).toBe(0);
    expect(v("voices_withdrawn_30d")).toBe(1);
    expect(v("recovery_conversion")).toBe(0.5);
    expect(voices.find((x) => x.voiceId === "aunt")).toMatchObject({ status: "withdrawn", storedBooks: 1, archiveHouseholds: 1 });
  });

  it("reports buyer-facing numbers: clone utilization, recording storage, referrals, deletions and MRR", () => {
    const more = voiceMetrics(
      input({
        revenue: [
          { household_id: "h2", kind: "subscription", amount_cents: 699, billing_interval: "month", period_start: ago(10), period_end: ago(-20) },
          { household_id: "h1", kind: "subscription", amount_cents: 17999, billing_interval: "year", period_start: ago(10), period_end: ago(-355) },
        ],
        recordingFiles: [
          { audio_bytes: 2_000_000, recording_deleted_at: null },
          { audio_bytes: 5_000_000, recording_deleted_at: ago(1) },
        ],
        referrals: [
          { referrer_user_id: "u1", paid_cycles: 2, qualified_at: ago(3), rejected_reason: null },
          { referrer_user_id: "u2", paid_cycles: 0, qualified_at: null, rejected_reason: null },
          { referrer_user_id: "u2", paid_cycles: 0, qualified_at: null, rejected_reason: "self_referral" },
          { referrer_user_id: "nobody", paid_cycles: 3, qualified_at: null, rejected_reason: null },
        ],
        deletionRequests: [
          { status: "pending", due_at: ago(-20), completed_at: null },
          { status: "pending", due_at: ago(1), completed_at: null },
          { status: "completed", due_at: ago(5), completed_at: ago(6) },
        ],
        exceptions: [{ status: "open" }],
      }),
    ).metrics;
    const m = (key: string) => more.find((x) => x.key === key)?.value;
    // Two active clones; only grandma's serves a Family household.
    expect(m("clone_utilization")).toBe(0.5);
    expect(m("clone_capacity_used")).toBe(0.067);
    expect(m("source_recording_bytes")).toBe(2_000_000);
    expect(m("contributor_referrals")).toBe(2);
    expect(m("contributor_referral_paid")).toBe(1);
    expect(m("contributor_referral_conversion")).toBe(0.5);
    expect(m("recording_deletions_pending")).toBe(2);
    expect(m("recording_deletions_overdue")).toBe(1);
    expect(m("lifecycle_exceptions_open")).toBe(1);
    expect(m("development_rights_contributors")).toBe(2);
    expect(m("family_mrr_cents")).toBe(1500);
    expect(m("archive_mrr_cents")).toBe(699);
  });

  it("exports every metric with its definition", () => {
    const csv = metricsCsv(metrics, at).trim().split("\n");
    expect(csv[0]).toBe("generated_at,group,key,label,value,unit,definition");
    expect(csv).toHaveLength(metrics.length + 1);
  });
});

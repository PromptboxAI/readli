import type { SupabaseClient } from "@supabase/supabase-js";
import { all } from "@/lib/lifecycle/db";
import { costConfig, monthlyValueCents, rateFor, savedCostSettings } from "./finance";

type Row = Record<string, unknown>;

const DAY = 86_400_000;
const HOUR_MS = 3_600_000;
const WINDOW_DAYS = 30;

/**
 * Voice Lifecycle and Acquisition Metrics for /admin/voices. Every number is computed from database
 * rows by this one function, and each metric carries the definition it was computed with, so the page
 * and the CSV export show the same thing and a reviewer can check it against the tables.
 */
export interface VoiceMetric {
  key: string;
  group: "Contributors" | "Clones" | "Households" | "Archive" | "Recovery" | "Deletion" | "Training rights" | "Provider";
  label: string;
  value: number;
  unit: "count" | "hours" | "cents" | "usd" | "ratio";
  definition: string;
}

export interface VoiceRow {
  voiceId: string;
  status: string;
  version: number;
  hasClone: boolean;
  unlinkedSince: string | null;
  familyHouseholds: number;
  archiveHouseholds: number;
  storedBooks: number;
  sourceRecordingHours: number;
}

export interface VoiceMetricsInput {
  at: Date;
  voices: Row[];
  entitlements: Row[];
  shares: Row[];
  libraries: Row[];
  readySegments: Row[];
  recordings: Row[];
  usable: Row[];
  agreements: Row[];
  events: Row[];
  recoveries: Row[];
  revenue: Row[];
  usage: Row[];
  costs: ReturnType<typeof costConfig>;
  providerVoiceLimit: number;
  cloneRetireAfterDays: number;
}

const ts = (v: unknown) => (typeof v === "string" ? Date.parse(v) : NaN);
const int = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const hours = (ms: number) => Math.round((ms / HOUR_MS) * 100) / 100;

function tiers(entitlements: Row[], t: number): Map<string, "family" | "archive"> {
  const out = new Map<string, "family" | "archive">();
  for (const e of entitlements) {
    if (e.status !== "active" || ts(e.starts_at) > t || (e.ends_at && ts(e.ends_at) <= t)) continue;
    const tier = (e.tier as string) === "archive" ? "archive" : "family";
    const h = e.household_id as string;
    if (out.get(h) !== "family") out.set(h, tier);
  }
  return out;
}

export function voiceMetrics(input: VoiceMetricsInput): { metrics: VoiceMetric[]; voices: VoiceRow[] } {
  const now = input.at.getTime();
  const since = now - WINDOW_DAYS * DAY;
  const tierOf = tiers(input.entitlements, now);
  const m: VoiceMetric[] = [];
  const add = (key: string, group: VoiceMetric["group"], label: string, value: number, unit: VoiceMetric["unit"], definition: string) =>
    m.push({ key, group, label, value, unit, definition });

  const live = input.voices.filter((v) => v.status === "ready" || v.status === "processing");
  const current = new Map(input.agreements.map((a) => [a.contributor_id as string, a]));
  const verified = new Set(
    live.map((v) => v.owner_id as string).filter((o) => {
      const a = current.get(o);
      return a && a.event !== "withdrawn" && a.service_rights === true && a.adult_owner_declared === true;
    }),
  );

  // Households by voice, from live shares.
  const sharedWith = new Map<string, string[]>();
  for (const s of input.shares) sharedWith.set(s.voice_id as string, [...(sharedWith.get(s.voice_id as string) ?? []), s.household_id as string]);
  const storedLibs = new Set(input.readySegments.map((s) => s.library_key as string));
  const booksByVoice = new Map<string, Set<string>>();
  for (const key of storedLibs) {
    const lib = input.libraries.find((l) => l.key === key);
    if (!lib) continue;
    const v = lib.voice_id as string;
    booksByVoice.set(v, (booksByVoice.get(v) ?? new Set()).add(lib.book_slug as string));
  }
  const recordingMsByVoice = new Map<string, number>();
  for (const r of input.recordings) recordingMsByVoice.set(r.voice_profile_id as string, (recordingMsByVoice.get(r.voice_profile_id as string) ?? 0) + int(r.duration_ms));

  const voices: VoiceRow[] = input.voices
    .filter((v) => v.status !== "deleted")
    .map((v) => {
      const hh = sharedWith.get(v.id as string) ?? [];
      return {
        voiceId: v.id as string,
        status: v.status as string,
        version: int(v.version) || 1,
        hasClone: Boolean(v.provider_voice_id_encrypted),
        unlinkedSince: (v.unlinked_since as string | null) ?? null,
        familyHouseholds: hh.filter((h) => tierOf.get(h) === "family").length,
        archiveHouseholds: hh.filter((h) => tierOf.get(h) === "archive").length,
        storedBooks: booksByVoice.get(v.id as string)?.size ?? 0,
        sourceRecordingHours: hours(recordingMsByVoice.get(v.id as string) ?? 0),
      };
    });

  const activeClones = live.filter((v) => v.status === "ready" && v.provider_voice_id_encrypted).length;
  add("verified_contributors", "Contributors", "Verified voice contributors", verified.size, "count", "Distinct adults with a ready or processing voice whose agreement in force grants service rights and declares adult ownership.");
  add("source_recordings", "Contributors", "Original source recordings", input.recordings.length, "count", "Stored original recording files (voice_training_segments) of adult account voices, kept in private Supabase storage.");
  add("source_recording_hours", "Contributors", "Original recording hours", hours(input.recordings.reduce((s, r) => s + int(r.duration_ms), 0)), "hours", "Total duration of those original recordings.");

  const retireSoon = live.filter(
    (v) => v.provider_voice_id_encrypted && v.unlinked_since && now - ts(v.unlinked_since) >= (input.cloneRetireAfterDays - 7) * DAY,
  ).length;
  const ev = (action: string, sinceT: number | null = null) =>
    input.events.filter((e) => e.action === action && e.dry_run !== true && (sinceT === null || ts(e.at) >= sinceT));
  add("active_clones", "Clones", "Active provider clones", activeClones, "count", "Ready voices with a live ElevenLabs clone.");
  add("retired_clones", "Clones", "Ready voices with a retired clone", live.filter((v) => v.status === "ready" && !v.provider_voice_id_encrypted).length, "count", "Ready voices whose clone was retired; remade from the original recording when a Family household needs them.");
  add("unlinked_nearing_retirement", "Clones", "Unlinked voices nearing clone retirement", retireSoon, "count", `Voices with a clone that no Readli Family household has shared for at least ${input.cloneRetireAfterDays - 7} days (retired at ${input.cloneRetireAfterDays}).`);
  add("clone_retired_30d", "Clones", "Clones retired, last 30 days", ev("clone_retired", since).length, "count", "clone_retired lifecycle events (not dry runs).");
  add("clone_reactivated_30d", "Clones", "Clones reactivated, last 30 days", ev("clone_reactivated", since).length, "count", "clone_reactivated lifecycle events: a retired clone remade from the original recording.");
  add("version_upgrades_30d", "Clones", "Voice version upgrades, last 30 days", ev("voice_version_upgraded", since).length, "count", "A contributor recorded again; earlier stories keep their original version.");

  const familyLinked = voices.filter((v) => v.familyHouseholds > 0).length;
  const archiveOnly = voices.filter((v) => v.familyHouseholds === 0 && v.archiveHouseholds > 0).length;
  const paidCounts = voices.map((v) => v.familyHouseholds + v.archiveHouseholds).filter((n) => n > 0);
  add("voices_family_linked", "Households", "Voices linked to Family households", familyLinked, "count", "Voices shared (live share) with at least one household on Readli Family now.");
  add("voices_archive_only", "Households", "Voices linked only to Archive households", archiveOnly, "count", "Voices shared only with households on Readli Family Archive now: playback only, no clone needed.");
  add("avg_paying_households_per_voice", "Households", "Average paying households per voice", paidCounts.length ? Math.round((paidCounts.reduce((a, b) => a + b, 0) / paidCounts.length) * 100) / 100 : 0, "ratio", "Across voices shared with at least one household on any plan: Family or Archive households per voice.");
  add("stored_books", "Households", "Stored narrated books", storedLibs.size, "count", "Narration libraries with at least one ready sentence of audio in private Supabase storage.");
  add("stored_narration_hours", "Households", "Stored narration hours", hours(input.readySegments.reduce((s, r) => s + int(r.duration_ms), 0)), "hours", "Total duration of ready narration audio.");

  const changes = (from: string, to: string, sinceT: number | null) =>
    ev("plan_changed", sinceT).filter((e) => (e.detail as Row | null)?.from === from && (e.detail as Row | null)?.to === to).length;
  const archiveHouseholds = new Set([...tierOf].filter(([, t]) => t === "archive").map(([h]) => h));
  let archiveMrr = 0;
  for (const r of input.revenue) if (r.kind === "subscription" && archiveHouseholds.has(r.household_id as string)) archiveMrr += monthlyValueCents(r, now);
  add("archive_households", "Archive", "Households on the Archive", archiveHouseholds.size, "count", "Households whose plan in force now is Readli Family Archive.");
  add("archive_mrr_cents", "Archive", "Archive MRR", Math.round(archiveMrr), "cents", "Monthly value of current paid subscription periods for households on the Archive now.");
  add("family_to_archive_30d", "Archive", "Family to Archive, last 30 days", changes("family", "archive", since), "count", "plan_changed events from family to archive.");
  add("archive_to_family_30d", "Archive", "Archive to Family upgrades, last 30 days", changes("archive", "family", since), "count", "plan_changed events from archive to family.");
  add("family_to_archive_all", "Archive", "Family to Archive, all time", changes("family", "archive", null), "count", "plan_changed events from family to archive.");

  const rec = (status: string) => input.recoveries.filter((r) => r.status === status);
  const started = input.recoveries.length;
  const restored = rec("restored");
  add("recovery_open", "Recovery", "Families in the recovery window", rec("recovering").length, "count", "Households whose paid access ended and whose stories are kept, not streaming, until the deletion date.");
  add("recovery_held", "Recovery", "Deletions held for review", rec("held").length, "count", "Recovery windows stopped because billing still showed a live subscription.");
  add("recovery_restored_family", "Recovery", "Recovered to Family", restored.filter((r) => r.restored_tier === "family").length, "count", "Recovery windows ended by choosing Readli Family.");
  add("recovery_restored_archive", "Recovery", "Recovered to the Archive", restored.filter((r) => r.restored_tier === "archive").length, "count", "Recovery windows ended by choosing the Archive.");
  add("recovery_conversion", "Recovery", "Recovery conversion rate", started ? Math.round((restored.length / started) * 1000) / 1000 : 0, "ratio", "Restored windows over every window opened.");
  add("recovery_deleted", "Recovery", "Families whose stories were deleted", rec("deleted").length, "count", "Recovery windows that reached Day 30 and passed every safeguard.");

  const overdue = rec("recovering").filter((r) => ts(r.deletion_due_at) + 2 * DAY < now).length;
  add("voices_withdrawn_30d", "Deletion", "Voices withdrawn by their owner, last 30 days", ev("voice_withdrawn", since).length, "count", "Owner deletions: no new stories or re-cloning; prepared stories kept; recordings out of training.");
  add("voices_withdrawn", "Deletion", "Withdrawn voices", input.voices.filter((v) => v.status === "withdrawn").length, "count", "Voices whose owner deleted them; stories prepared in them still play.");
  add("legal_removals", "Deletion", "Legal removals carried out", ev("legal_removal").length, "count", "Targeted legal removals (not dry runs), each with its reason and reference in the lifecycle log.");
  add("deletions_overdue", "Deletion", "Recovery deletions overdue", overdue, "count", "Windows more than two days past their deletion date and still open: check the lifecycle run log.");
  add("safeguard_stops_30d", "Deletion", "Safeguard stops, last 30 days", ev("safeguard_stopped", since).length, "count", "Deletions deferred by a safeguard (billing check, recent plan change, notice timing, mass-deletion brake).");

  add("internal_training_hours", "Training rights", "Hours authorized for Readli development", hours(input.usable.filter((u) => u.readli_development_rights === true).reduce((s, u) => s + int(u.duration_ms), 0)), "hours", "Original recordings in voice_recordings_usable whose agreement in force grants Readli development rights.");
  add("third_party_hours", "Training rights", "Hours authorized for third-party licensing", hours(input.usable.filter((u) => u.third_party_licensing === true).reduce((s, u) => s + int(u.duration_ms), 0)), "hours", "Original recordings whose contributor opted in to third-party licensing. Children's voices never appear.");
  add("third_party_contributors", "Training rights", "Contributors opted in to third-party licensing", new Set(input.usable.filter((u) => u.third_party_licensing === true).map((u) => u.contributor_id as string)).size, "count", "Distinct contributors in that set.");

  const usage30 = input.usage;
  const genUsd = usage30.reduce((s, u) => {
    const recorded = u.usd === null || u.usd === undefined ? NaN : Number(u.usd);
    return s + (Number.isFinite(recorded) ? recorded : (int(u.characters) / 1000) * rateFor(input.costs, u.model_id));
  }, 0);
  add("provider_clone_capacity", "Provider", "Provider clone capacity", input.providerVoiceLimit, "count", "Custom voices the ElevenLabs plan allows (ELEVENLABS_VOICE_LIMIT; confirm against the plan).");
  add("provider_clone_headroom", "Provider", "Provider clone headroom", input.providerVoiceLimit - activeClones, "count", "Capacity minus active clones.");
  add("provider_plan_usd", "Provider", `Provider plan (${input.costs.providerPlanName})`, input.costs.providerPlanMonthlyUsd, "usd", "Monthly ElevenLabs plan fee from finance settings.");
  add("provider_generation_usd_30d", "Provider", "Generation cost, last 30 days", Math.round(genUsd * 100) / 100, "usd", "Recorded provider cost, or characters at the finance settings rate.");

  return { metrics: m, voices };
}

/** Reads what the metrics need with the service key. */
export async function loadVoiceMetrics(db: SupabaseClient, { live, at = new Date(), cloneRetireAfterDays }: { live: boolean; at?: Date; cloneRetireAfterDays: number }) {
  const since = new Date(at.getTime() - WINDOW_DAYS * DAY).toISOString();
  const [voices, entitlements, shares, libraries, readySegments, sessions, usable, agreements, events, recoveries, revenue, usage, saved] = await Promise.all([
    all(() => db.from("voice_profiles").select("*").order("id"), "read voices"),
    all(() => db.from("household_entitlements").select("household_id, status, tier, starts_at, ends_at").order("id"), "read plans"),
    all(() => db.from("voice_household_shares").select("voice_id, household_id").is("revoked_at", null).order("id"), "read sharing"),
    all(() => db.from("narration_libraries").select("key, voice_id, book_slug").order("key"), "read libraries"),
    all(() => db.from("narration_segments").select("library_key, duration_ms").eq("status", "ready").order("library_key").order("sentence_id"), "read narration"),
    all(() => db.from("voice_training_sessions").select("id, voice_profile_id").not("owner_id", "is", null).not("voice_profile_id", "is", null).order("id"), "read recordings"),
    all(() => db.from("voice_recordings_usable").select("contributor_id, duration_ms, readli_development_rights, third_party_licensing").order("session_id"), "read training rights"),
    all(() => db.from("voice_rights_current").select("contributor_id, event, service_rights, adult_owner_declared").order("contributor_id"), "read agreements"),
    all(() => db.from("lifecycle_audit_log").select("action, at, dry_run, detail").order("id"), "read lifecycle log"),
    all(() => db.from("household_recovery").select("status, restored_tier, deletion_due_at").order("household_id"), "read recovery"),
    all(() => db.from("revenue_events").select("household_id, kind, amount_cents, billing_interval, period_start, period_end").eq("livemode", live).order("id"), "read revenue"),
    all(() => db.from("narration_provider_usage").select("*").gte("at", since).order("at"), "read provider usage"),
    savedCostSettings(db),
  ]);
  const sessionVoice = new Map(sessions.map((s) => [s.id as string, s.voice_profile_id as string]));
  const segs = sessionVoice.size
    ? await all(() => db.from("voice_training_segments").select("session_id, duration_ms").order("id"), "read recording files")
    : [];
  const recordings = segs.filter((s) => sessionVoice.has(s.session_id as string)).map((s) => ({ ...s, voice_profile_id: sessionVoice.get(s.session_id as string) }));
  return voiceMetrics({
    at,
    voices,
    entitlements,
    shares,
    libraries,
    readySegments,
    recordings,
    usable,
    agreements,
    events,
    recoveries,
    revenue,
    usage,
    costs: costConfig(process.env, saved),
    providerVoiceLimit: Number(process.env.ELEVENLABS_VOICE_LIMIT ?? 30) || 30,
    cloneRetireAfterDays,
  });
}

function cell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], data: unknown[][]): string {
  return [header, ...data].map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

export function metricsCsv(metrics: VoiceMetric[], at: Date): string {
  return toCsv(["generated_at", "group", "key", "label", "value", "unit", "definition"], metrics.map((x) => [at.toISOString(), x.group, x.key, x.label, x.value, x.unit, x.definition]));
}

export function voicesCsv(voices: VoiceRow[]): string {
  return toCsv(
    ["voice_id", "status", "version", "has_clone", "unlinked_since", "family_households", "archive_households", "stored_books", "source_recording_hours"],
    voices.map((v) => [v.voiceId, v.status, v.version, v.hasClone, v.unlinkedSince, v.familyHouseholds, v.archiveHouseholds, v.storedBooks, v.sourceRecordingHours]),
  );
}

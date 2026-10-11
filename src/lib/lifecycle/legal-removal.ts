import type { SupabaseClient } from "@supabase/supabase-js";
import { keysOf, NARRATION_BUCKETS, RECORDINGS_BUCKET, removeObjects } from "@/lib/account/privacy";
import type { FamilyState } from "@/lib/family/model";
import type { FamilyStore } from "@/lib/family/service";
import { stopJob } from "@/lib/narration/narration";
import { all, allIn, run, writeAudit, type AuditEntry, type Row } from "./db";

/**
 * Legally required removal of narration (and, for a whole voice, the voice itself). This is the only
 * path that deletes stories already prepared for families: deleting or replacing a voice, moving to
 * the Archive or a plan ending never does. It is targeted (one voice, optionally one book), admin-only,
 * always previewed as a dry run first, and every run is written to the lifecycle audit log with the
 * reason and the legal reference.
 */

export interface RemovalTarget {
  voiceId: string;
  /** Only this book's narration; omit to remove the whole voice. */
  bookSlug?: string | null;
}

export interface RemovalRequest extends RemovalTarget {
  /** Why it is legally required, in a sentence. */
  reason: string;
  /** The ticket, court order or request it answers. */
  reference: string;
  /** Who asked for it (admin email or id). */
  requestedBy: string;
  /** Whole-voice removals also delete the original recordings unless told not to. */
  includeRecordings?: boolean;
}

export interface RemovalPlan {
  target: RemovalTarget;
  wholeVoice: boolean;
  libraryKeys: string[];
  /** Ready sentences of narration that would be deleted. */
  segments: number;
  storageKeys: string[];
  /** Unfinished jobs that stop, with unused credits refunded. */
  jobIds: string[];
  /** Families who lose stories, from the library scopes and the voice's live shares. */
  households: string[];
  /** Original recordings deleted (whole voice only). */
  recordings: number;
}

export class RemovalError extends Error {}

export interface RemovalRows {
  libraries: { key: string; voiceId: string; bookSlug: string; scope: string }[];
  segments: { libraryKey: string; storageKey: string | null }[];
  jobs: { id: string; libraryKey: string; status: string }[];
  /** Households with a live share of the voice. */
  sharedWith: string[];
  recordingKeys: string[];
}

export function validateRequest(req: RemovalRequest): void {
  if (!/^[0-9a-f-]{36}$/i.test(req.voiceId) && !req.voiceId.startsWith("voice-")) throw new RemovalError("Give the voice id to remove.");
  if (req.reason.trim().length < 10) throw new RemovalError("Say why this removal is legally required.");
  if (!req.reference.trim()) throw new RemovalError("Add the legal reference (request, ticket or order).");
}

/** What a removal would take. Pure, so the dry run and the real run can't disagree. */
export function planRemoval(data: RemovalRows, target: RemovalTarget, includeRecordings = true): RemovalPlan {
  const wholeVoice = !target.bookSlug;
  const libraries = data.libraries.filter((l) => l.voiceId === target.voiceId && (wholeVoice || l.bookSlug === target.bookSlug));
  const keys = new Set(libraries.map((l) => l.key));
  const segments = data.segments.filter((s) => keys.has(s.libraryKey));
  const scoped = libraries.map((l) => l.scope).filter((s) => s !== "shared");
  const anyShared = libraries.some((l) => l.scope === "shared");
  return {
    target,
    wholeVoice,
    libraryKeys: [...keys],
    segments: segments.filter((s) => s.storageKey).length,
    storageKeys: [...new Set(segments.map((s) => s.storageKey).filter((k): k is string => Boolean(k)))],
    jobIds: data.jobs.filter((j) => keys.has(j.libraryKey) && (j.status === "queued" || j.status === "running")).map((j) => j.id),
    households: [...new Set([...scoped, ...(anyShared || wholeVoice ? data.sharedWith : [])])],
    recordings: wholeVoice && includeRecordings ? data.recordingKeys.length : 0,
  };
}

function auditEntry(req: RemovalRequest, plan: RemovalPlan, dryRun: boolean): AuditEntry {
  return {
    actor: req.requestedBy,
    action: "legal_removal",
    voiceId: req.voiceId,
    dryRun,
    detail: {
      book: req.bookSlug ?? null,
      whole_voice: plan.wholeVoice,
      reason: req.reason.trim(),
      reference: req.reference.trim(),
      libraries: plan.libraryKeys.length,
      segments: plan.segments,
      jobs_stopped: plan.jobIds.length,
      households: plan.households,
      recordings: plan.recordings,
    },
  };
}

// ---------------------------------------------------------------------------
// Preview and tests: a FamilyStore
// ---------------------------------------------------------------------------

function rowsFromState(state: FamilyState, voiceId: string): RemovalRows {
  return {
    libraries: state.libraries.map((l) => ({ key: l.key, voiceId: l.voiceId, bookSlug: l.bookSlug, scope: l.scope })),
    segments: state.segments.map((s) => ({ libraryKey: s.libraryKey, storageKey: s.storageKey })),
    jobs: state.jobs.map((j) => ({ id: j.id, libraryKey: j.libraryKey, status: j.status })),
    sharedWith: [...new Set(state.shares.filter((s) => s.voiceId === voiceId && s.revokedAt === null).map((s) => s.householdId))],
    recordingKeys: [],
  };
}

/** Runs a removal against a family store (the preview, and tests). Returns the plan and its audit entry. */
export async function removeFromFamilyStore(
  store: FamilyStore,
  req: RemovalRequest,
  opts: { dryRun: boolean },
  clock: () => Date = () => new Date(),
): Promise<{ plan: RemovalPlan; audit: AuditEntry }> {
  validateRequest(req);
  const state = await store.read();
  if (!state.voices.some((v) => v.id === req.voiceId)) throw new RemovalError("No voice has that id.");
  const plan = planRemoval(rowsFromState(state, req.voiceId), req, req.includeRecordings ?? true);
  if (opts.dryRun) return { plan, audit: auditEntry(req, plan, true) };
  const at = clock().toISOString();
  const keys = new Set(plan.libraryKeys);
  await store.write((s) => {
    for (const job of s.jobs) if (plan.jobIds.includes(job.id)) stopJob(s, job, at);
  });
  await store.audio.delete(plan.storageKeys);
  await store.write((s) => {
    s.segments = s.segments.filter((x) => !keys.has(x.libraryKey));
    if (!plan.wholeVoice) return;
    const voice = s.voices.find((v) => v.id === req.voiceId)!;
    Object.assign(voice, { status: "deleted", deletedAt: at, cloneRetiredAt: voice.cloneRetiredAt ?? at });
    for (const a of s.approvals) {
      if (a.voiceId === req.voiceId && a.revokedAt === null) Object.assign(a, { revokedAt: at, revokedBy: req.requestedBy, revokeReason: "voice_deleted" });
    }
    for (const sh of s.shares) if (sh.voiceId === req.voiceId && sh.revokedAt === null) Object.assign(sh, { revokedAt: at, revokedBy: req.requestedBy });
    for (const sl of s.slots) if (sl.voiceId === req.voiceId && sl.releasedAt === null) Object.assign(sl, { releasedAt: at, releasedBy: req.requestedBy });
  });
  return { plan, audit: auditEntry(req, plan, false) };
}

// ---------------------------------------------------------------------------
// Production: Supabase with the service role
// ---------------------------------------------------------------------------

async function loadRows(db: SupabaseClient, req: RemovalRequest): Promise<{ data: RemovalRows; voice: Row; recordingSessions: string[] }> {
  const voice = (await all(() => db.from("voice_profiles").select("id, owner_id, status, provider_voice_id_encrypted").eq("id", req.voiceId), "read voice"))[0];
  if (!voice) throw new RemovalError("No voice has that id.");
  let libQuery = () => db.from("narration_libraries").select("key, voice_id, book_slug, scope").eq("voice_id", req.voiceId);
  if (req.bookSlug) {
    const slug = req.bookSlug;
    libQuery = () => db.from("narration_libraries").select("key, voice_id, book_slug, scope").eq("voice_id", req.voiceId).eq("book_slug", slug);
  }
  const libraries = await all(libQuery, "read narration libraries");
  const keys = libraries.map((l) => l.key as string);
  const [segments, jobs, shares, sessions] = await Promise.all([
    allIn(db, "narration_segments", "library_key, storage_key", "library_key", keys, "read narration"),
    allIn(db, "narration_jobs", "id, library_key, status", "library_key", keys, "read narration jobs"),
    all(() => db.from("voice_household_shares").select("household_id").eq("voice_id", req.voiceId).is("revoked_at", null), "read sharing"),
    req.bookSlug ? Promise.resolve([] as Row[]) : all(() => db.from("voice_training_sessions").select("id").eq("voice_profile_id", req.voiceId), "read recordings"),
  ]);
  const sessionIds = sessions.map((x) => x.id as string);
  const takes = sessionIds.length ? await allIn(db, "voice_training_segments", "storage_key", "session_id", sessionIds, "read recordings") : [];
  return {
    voice,
    recordingSessions: sessionIds,
    data: {
      libraries: libraries.map((l) => ({ key: l.key as string, voiceId: l.voice_id as string, bookSlug: l.book_slug as string, scope: l.scope as string })),
      segments: segments.map((s) => ({ libraryKey: s.library_key as string, storageKey: (s.storage_key as string | null) ?? null })),
      jobs: jobs.map((j) => ({ id: j.id as string, libraryKey: j.library_key as string, status: j.status as string })),
      sharedWith: [...new Set(shares.map((s) => s.household_id as string))],
      recordingKeys: keysOf(takes),
    },
  };
}

/**
 * Runs a removal in production. The dry run reads and logs only. The real run stops unfinished jobs
 * (refunding unused credits), deletes the narration audio and its sentence rows (library rows stay for
 * credit history), and for a whole voice also deletes the provider clone (through `deleteClone`), the
 * older narration assets and, unless told not to, the original recordings; then marks the voice
 * deleted and ends its approvals and shares.
 */
export async function removeInSupabase(
  db: SupabaseClient,
  req: RemovalRequest,
  opts: { dryRun: boolean; deleteClone?: (encryptedProviderId: string) => Promise<void> },
): Promise<RemovalPlan> {
  validateRequest(req);
  const { data, voice, recordingSessions } = await loadRows(db, req);
  const plan = planRemoval(data, req, req.includeRecordings ?? true);
  if (opts.dryRun) {
    await writeAudit(db, [auditEntry(req, plan, true)]);
    return plan;
  }
  const at = new Date().toISOString();
  for (const jobId of plan.jobIds) {
    await run(db.from("narration_jobs").update({ status: "canceled", finished_at: at }).eq("id", jobId).in("status", ["queued", "running"]), "stop narration job");
    await run(db.rpc("settle_narration_job", { p_job: jobId }), "refund narration job");
  }
  await removeObjects(db, NARRATION_BUCKETS.segments, plan.storageKeys);
  for (let i = 0; i < plan.libraryKeys.length; i += 200) {
    await run(db.from("narration_segments").delete().in("library_key", plan.libraryKeys.slice(i, i + 200)), "delete narration");
  }
  if (plan.wholeVoice) {
    const encrypted = voice.provider_voice_id_encrypted as string | null;
    if (encrypted && opts.deleteClone) await opts.deleteClone(encrypted);
    const assets = await all(() => db.from("narration_assets").select("storage_key").eq("voice_id", req.voiceId), "read older narration audio");
    await removeObjects(db, NARRATION_BUCKETS.assets, keysOf(assets));
    await run(db.from("narration_assets").delete().eq("voice_id", req.voiceId), "delete older narration");
    if (req.includeRecordings ?? true) {
      await removeObjects(db, RECORDINGS_BUCKET, data.recordingKeys);
      for (let i = 0; i < recordingSessions.length; i += 200) {
        await run(db.from("voice_training_segments").delete().in("session_id", recordingSessions.slice(i, i + 200)), "delete recordings");
      }
    }
    // Kids lose it first (so the reason reads "voice deleted"), then families.
    await run(
      db.from("child_voice_approvals").update({ revoked_at: at, revoked_by: voice.owner_id, revoke_reason: "voice_deleted" }).eq("voice_id", req.voiceId).is("revoked_at", null),
      "end kids approvals",
    );
    await run(db.from("voice_household_shares").update({ revoked_at: at, revoked_by: voice.owner_id }).eq("voice_id", req.voiceId).is("revoked_at", null), "end sharing");
    await run(db.from("voice_consents").update({ revoked_at: at }).eq("voice_id", req.voiceId).is("revoked_at", null), "withdraw voice consent");
    await run(
      db.from("voice_profiles").update({ status: "deleted", deleted_at: at, updated_at: at, provider_voice_id_encrypted: null, clone_retired_at: at }).eq("id", req.voiceId),
      "mark voice removed",
    );
  }
  await writeAudit(db, [auditEntry(req, plan, false)]);
  return plan;
}

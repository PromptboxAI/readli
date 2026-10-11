import type { SupabaseClient } from "@supabase/supabase-js";
import { folderKeys, keysOf, RECORDINGS_BUCKET, removeObjects } from "@/lib/account/privacy";
import { allIn, rows, run } from "./db";

/**
 * Deleting original voice recordings (Kevin, 2026-10-11, decision 4). A deletion request is different
 * from turning off family sharing or withdrawing AI-training permission: it removes the source
 * recordings from Readli's active storage. The request takes effect at once for processing (the
 * recordings leave voice_recordings_usable), and the files are removed by the daily lifecycle run,
 * normally within 30 days. Requests that can't be completed go to the admin exception queue.
 * Stories already made from the voice are not recordings and are not affected.
 */

const DAY = 86_400_000;
export const RECORDING_DELETION_DAYS = 30;

export type DeletionReason = "owner_request" | "account_deletion" | "household_cleanup" | "legal";

export async function requestRecordingDeletion(
  db: SupabaseClient,
  r: { ownerId: string; voiceId: string | null; reason: DeletionReason; at: Date; detail?: Record<string, unknown> },
): Promise<{ id: string; dueAt: string; existing: boolean }> {
  let q = db.from("voice_recording_deletions").select("id, due_at").eq("owner_id", r.ownerId).eq("status", "pending");
  q = r.voiceId ? q.eq("voice_id", r.voiceId) : q.is("voice_id", null);
  const pending = await rows(q.limit(1), "read deletion requests");
  if (pending[0]) return { id: pending[0].id as string, dueAt: pending[0].due_at as string, existing: true };
  const dueAt = new Date(r.at.getTime() + RECORDING_DELETION_DAYS * DAY).toISOString();
  const [saved] = await rows(
    db
      .from("voice_recording_deletions")
      .insert({ owner_id: r.ownerId, voice_id: r.voiceId, reason: r.reason, requested_at: r.at.toISOString(), due_at: dueAt, detail: r.detail ?? {} })
      .select("id"),
    "request recording deletion",
  );
  return { id: saved!.id as string, dueAt, existing: false };
}

export interface DeletionOutcome {
  id: string;
  files: number;
  sessions: number;
}

/**
 * Removes the recordings for one request and marks it completed. Safe to repeat. The session rows stay
 * (with recording_deleted_at) as the record of what existed; the agreement history is untouched.
 */
export async function carryOutRecordingDeletion(db: SupabaseClient, request: { id: string; owner_id: string | null; voice_id: string | null }, at: string): Promise<DeletionOutcome> {
  let sessions: Record<string, unknown>[] = [];
  if (request.voice_id) {
    sessions = await rows(db.from("voice_training_sessions").select("id").eq("voice_profile_id", request.voice_id), "read recording sessions");
  } else if (request.owner_id) {
    sessions = await rows(db.from("voice_training_sessions").select("id").eq("owner_id", request.owner_id), "read recording sessions");
  }
  const sessionIds = sessions.map((s) => s.id as string);
  const takes = await allIn(db, "voice_training_segments", "storage_key", "session_id", sessionIds, "read recordings");
  const keys = new Set(keysOf(takes));
  // A whole-account request also clears stray uploads in the owner's folder.
  if (!request.voice_id && request.owner_id) for (const k of await folderKeys(db, RECORDINGS_BUCKET, request.owner_id)) keys.add(k);
  const files = await removeObjects(db, RECORDINGS_BUCKET, [...keys]);
  for (let i = 0; i < sessionIds.length; i += 200) {
    await run(db.from("voice_training_sessions").update({ recording_deleted_at: at }).in("id", sessionIds.slice(i, i + 200)).is("recording_deleted_at", null), "mark recordings deleted");
  }
  await run(
    db.from("voice_recording_deletions").update({ status: "completed", completed_at: at, files_removed: files, last_error: null }).eq("id", request.id),
    "complete deletion request",
  );
  return { id: request.id, files, sessions: sessionIds.length };
}

export async function pendingRecordingDeletions(db: SupabaseClient, limit = 200): Promise<Record<string, unknown>[]> {
  return rows(db.from("voice_recording_deletions").select("id, owner_id, voice_id, reason, due_at, attempts").eq("status", "pending").order("due_at").limit(limit), "read deletion requests");
}

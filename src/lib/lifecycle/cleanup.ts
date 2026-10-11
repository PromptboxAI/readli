import type { SupabaseClient } from "@supabase/supabase-js";
import { keysOf, NARRATION_BUCKETS, removeObjects } from "@/lib/account/privacy";
import { allIn, rows, run } from "./db";

/**
 * Removes what belongs to one household alone (Kevin, 2026-10-11, decision 2), for the Day-30 cleanup
 * and for a deleted account's solo household. Safe to repeat: every step deletes what is still there.
 *
 * Removed: the listed narration libraries' audio (the planner lists only narration no other eligible
 * household can play), older per-kid narration, kids profiles with their approvals, favourites,
 * reading places, plays and listening sessions, the household's notifications, and invitations nobody
 * accepted.
 * Kept: the household row, its plans, credit lots and ledger, payments, revenue and every audit
 * record, and all voices and recordings (recordings are handled by recording deletion requests).
 */
export interface CleanupResult {
  audioFiles: number;
  kids: number;
  libraries: number;
}

export async function cleanHousehold(db: SupabaseClient, householdId: string, libraryKeys: string[], at: string): Promise<CleanupResult> {
  const segments = await allIn(db, "narration_segments", "storage_key", "library_key", libraryKeys, "read narration");
  const kids = await rows(db.from("child_profiles").select("id").eq("household_id", householdId), "read kids");
  const kidIds = kids.map((k) => k.id as string);
  const assets = await allIn(db, "narration_assets", "storage_key", "child_id", kidIds, "read older narration");
  // Files first: if a later step fails, the rerun finds the rows again and finishes the job.
  const audioFiles = (await removeObjects(db, NARRATION_BUCKETS.segments, keysOf(segments))) + (await removeObjects(db, NARRATION_BUCKETS.assets, keysOf(assets)));
  for (let i = 0; i < libraryKeys.length; i += 200) {
    await run(db.from("narration_segments").delete().in("library_key", libraryKeys.slice(i, i + 200)), "delete narration");
  }
  await run(db.from("listening_sessions").delete().eq("household_id", householdId), "delete listening sessions");
  await run(db.from("narration_plays").delete().eq("household_id", householdId), "delete listening history");
  for (let i = 0; i < kidIds.length; i += 200) {
    await run(db.from("child_profiles").delete().in("id", kidIds.slice(i, i + 200)), "delete kids profiles");
  }
  await run(db.from("family_notifications").delete().eq("household_id", householdId), "delete notifications");
  await run(db.from("household_invitations").delete().eq("household_id", householdId).is("accepted_at", null), "delete pending invitations");
  await run(db.from("households").update({ cleaned_at: at }).eq("id", householdId), "mark household cleaned");
  return { audioFiles, kids: kidIds.length, libraries: libraryKeys.length };
}

/**
 * Purchased credits not yet spent. These are never forfeited automatically: a household with a
 * balance goes to the admin exception queue to be reconciled.
 */
export async function purchasedBalance(db: SupabaseClient, householdId: string): Promise<number> {
  const lots = await rows(db.from("narration_credit_lots").select("id, credits").eq("household_id", householdId).eq("source", "purchased"), "read purchased credits");
  if (!lots.length) return 0;
  const ledger = await allIn(db, "narration_credit_ledger", "lot_id, kind, credits", "lot_id", lots.map((l) => l.id as string), "read credit ledger");
  const used = ledger.reduce((n, e) => n + (e.kind === "reserve" ? (e.credits as number) : e.kind === "refund" ? -(e.credits as number) : 0), 0);
  return Math.max(0, lots.reduce((n, l) => n + (l.credits as number), 0) - used);
}

export async function openException(
  db: SupabaseClient,
  e: { kind: string; reason: string; householdId?: string | null; voiceId?: string | null; detail?: Record<string, unknown> },
): Promise<void> {
  // One open exception per kind and subject, so a daily rerun doesn't pile up duplicates.
  let q = db.from("lifecycle_exceptions").select("id").eq("kind", e.kind).eq("status", "open");
  q = e.householdId ? q.eq("household_id", e.householdId) : q.is("household_id", null);
  q = e.voiceId ? q.eq("voice_id", e.voiceId) : q.is("voice_id", null);
  if ((await rows(q.limit(1), "read exceptions")).length) return;
  await run(
    db.from("lifecycle_exceptions").insert({ kind: e.kind, status: "open", reason: e.reason, household_id: e.householdId ?? null, voice_id: e.voiceId ?? null, detail: e.detail ?? {} }),
    "open exception",
  );
}

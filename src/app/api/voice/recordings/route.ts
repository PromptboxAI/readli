import { NextResponse } from "next/server";
import { VOICE_CHOICES_NOTICE_VERSION } from "@/lib/content/voice-agreement";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody } from "@/lib/family/http";
import { writeAudit } from "@/lib/lifecycle/db";
import { cloneMayRemain, requestRecordingDeletion } from "@/lib/lifecycle/recordings";
import { lifecycleFlags } from "@/lib/lifecycle/run";
import { serverConfig } from "@/lib/server/config";
import { fail } from "@/lib/server/http";
import { accountVoiceDeps, retireUnusedClone } from "@/lib/voice/account-voices";
import { voiceOwner } from "@/lib/voice/owner";

export const dynamic = "force-dynamic";

const SIGN_IN = "Please sign in to manage your voice recordings.";

/** The grown-up's latest request to delete their original recordings, if any. */
export async function GET() {
  const owner = await voiceOwner(SIGN_IN);
  if ("error" in owner) return owner.error;
  const db = accountDb();
  if (!db) return fail(404, "accounts_off", "Accounts aren't switched on yet.");
  const { data } = await db
    .from("voice_recording_deletions")
    .select("requested_at, due_at, status, completed_at")
    .eq("owner_id", owner.user.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ latest: data ?? null }, { headers: { "cache-control": "no-store" } });
}

/**
 * "Delete my original recordings" (action A), { acknowledged: true } after the grown-up read the notice.
 * The recordings stop being used at once and are removed from storage normally within 30 days. The story
 * voice keeps working only while it still has a valid use (cloneMayRemain); otherwise its clone is
 * retired now. Stopping sharing and deleting the voice are separate actions.
 */
export async function POST(req: Request) {
  const owner = await voiceOwner(SIGN_IN);
  if ("error" in owner) return owner.error;
  const { acknowledged } = await jsonBody(req);
  if (acknowledged !== true) return fail(400, "confirm_required", "Please read and confirm what deleting your recordings does.");
  const db = accountDb();
  if (!db) return fail(404, "accounts_off", "Accounts aren't switched on yet.");
  const now = new Date();
  const clone = await cloneMayRemain(db, owner.user.id);
  const request = await requestRecordingDeletion(db, {
    ownerId: owner.user.id,
    voiceId: null,
    reason: "owner_request",
    at: now,
    detail: { action: "delete_recordings", notice: VOICE_CHOICES_NOTICE_VERSION, clone_kept: clone.keep },
  });
  let cloneRetired = false;
  // Retiring the clone at once waits for LIFECYCLE_CLONE_RETIREMENT (Kevin, 2026-10-12).
  if (clone.voiceId && !clone.keep && lifecycleFlags().cloneRetirement) {
    const deps = accountVoiceDeps(serverConfig());
    if (deps) cloneRetired = await retireUnusedClone(deps, clone.voiceId);
  }
  if (!request.existing) {
    await writeAudit(db, [
      { actor: "voice-owner", action: "recording_deletion_requested", voiceId: clone.voiceId ?? undefined, detail: { request: request.id, due_at: request.dueAt, clone_kept: clone.keep, clone_retired: cloneRetired } },
    ]);
  }
  return NextResponse.json({ dueAt: request.dueAt, existing: request.existing, cloneKept: clone.keep }, { status: request.existing ? 200 : 201 });
}

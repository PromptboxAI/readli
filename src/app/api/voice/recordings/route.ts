import { NextResponse } from "next/server";
import { accountDb } from "@/lib/family/account-store";
import { writeAudit } from "@/lib/lifecycle/db";
import { requestRecordingDeletion } from "@/lib/lifecycle/recordings";
import { fail } from "@/lib/server/http";
import { voiceOwner } from "@/lib/voice/owner";

export const dynamic = "force-dynamic";

const SIGN_IN = "Please sign in to manage your voice recordings.";

/** The grown-up's pending request to delete their original recordings, if any. */
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
 * Asks Readli to delete every original recording of this grown-up. They stop being used at once and
 * are removed from storage normally within 30 days. Their voice, family sharing and stories already
 * made are unchanged; deleting the voice or the account are separate choices.
 */
export async function POST() {
  const owner = await voiceOwner(SIGN_IN);
  if ("error" in owner) return owner.error;
  const db = accountDb();
  if (!db) return fail(404, "accounts_off", "Accounts aren't switched on yet.");
  const now = new Date();
  const request = await requestRecordingDeletion(db, { ownerId: owner.user.id, voiceId: null, reason: "owner_request", at: now });
  if (!request.existing) {
    await writeAudit(db, [{ actor: "voice-owner", action: "recording_deletion_requested", detail: { request: request.id, due_at: request.dueAt } }]);
  }
  return NextResponse.json({ dueAt: request.dueAt, existing: request.existing }, { status: request.existing ? 200 : 201 });
}

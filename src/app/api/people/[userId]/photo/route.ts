import { NextResponse } from "next/server";
import { signedPhotoUrl } from "@/lib/account/photos";
import { accountDb } from "@/lib/family/account-store";
import { approvedVoiceIds } from "@/lib/family/permissions";
import { currentSession, familyStore } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * A grown-up's profile photo, for people who share a family with them. Redirects to a short-lived signed link.
 * In Readli Kids the child sees only the photos of storytellers approved to read to them.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const session = await currentSession();
  const viewer = session?.account?.id;
  const db = accountDb();
  if (!session || !viewer || !db) return fail(404, "no_photo", "No photo.");
  if (session.actor.kind === "child") {
    const store = await familyStore(session);
    const state = store ? await store.read() : null;
    const childId = session.actor.childId;
    const reads = state ? approvedVoiceIds(state, childId, store!.plan).some((id) => state.voices.find((v) => v.id === id)?.ownerId === userId) : false;
    if (!reads) return fail(404, "no_photo", "No photo.");
  }
  const url = await signedPhotoUrl(db, viewer, userId);
  if (!url) return fail(404, "no_photo", "No photo.");
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, max-age=240" } });
}

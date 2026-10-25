import { NextResponse } from "next/server";
import { photoFile } from "@/lib/account/photos";
import { accountDb } from "@/lib/family/account-store";
import { approvedVoiceIds } from "@/lib/family/permissions";
import { currentSession, familyStore } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * A grown-up's profile photo, for people who share a family with them. The address carries the photo's
 * consent time, so a new photo gets a new address and the browser can keep this one for a day: on a reload
 * the avatar comes straight from its cache instead of waiting on sign-in checks and storage. In Readli Kids the child sees only the photos of storytellers approved to read to them.
 */
export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
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
  const file = await photoFile(db, viewer, userId);
  if (!file) return fail(404, "no_photo", "No photo.");
  const headers = { "cache-control": "private, max-age=86400", etag: file.tag };
  if (req.headers.get("if-none-match") === file.tag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(file.body, { headers: { ...headers, "content-type": file.body.type || "image/jpeg" } });
}

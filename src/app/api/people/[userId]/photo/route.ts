import { NextResponse } from "next/server";
import { signedPhotoUrl } from "@/lib/account/photos";
import { accountDb } from "@/lib/family/account-store";
import { currentSession } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** A grown-up's profile photo, for people who share a family with them. Redirects to a short-lived signed link. */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const viewer = (await currentSession())?.account?.id;
  const db = accountDb();
  if (!viewer || !db) return fail(404, "no_photo", "No photo.");
  const url = await signedPhotoUrl(db, viewer, userId);
  if (!url) return fail(404, "no_photo", "No photo.");
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "private, max-age=240" } });
}

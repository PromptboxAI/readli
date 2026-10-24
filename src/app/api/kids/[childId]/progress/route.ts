import { NextResponse } from "next/server";
import { findCatalogBook } from "@/lib/library/catalog";
import { revisionInfo } from "@/lib/library/revisions";
import { jsonBody, withFamily } from "@/lib/family/http";
import { heardAt } from "@/lib/family/places";
import { saveChildProgress } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Saves this child's own place and narrator in a book: { bookSlug, sentence, voiceId, textRevision?,
 * listenedAt?, sentAt? }, where the place counts in that text. listenedAt and sentAt are the device's
 * clock when the place was reached and when this was sent; a place heard earlier than the saved one is
 * not saved ({ saved: false }), so a late or retried save never moves the child back.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const body = await jsonBody(req);
  const { bookSlug, sentence, voiceId, textRevision } = body;
  if (typeof bookSlug !== "string" || !findCatalogBook(bookSlug) || !Number.isInteger(sentence) || (sentence as number) < 0 || (voiceId !== null && typeof voiceId !== "string")) {
    return fail(400, "bad_request", "That page doesn't exist.");
  }
  const revision = typeof textRevision === "string" && revisionInfo(bookSlug, textRevision) ? textRevision : null;
  return withFamily(async ({ store, actor }) => {
    const saved = await saveChildProgress(store, actor, {
      childId,
      bookSlug,
      sentence: sentence as number,
      voiceId: voiceId as string | null,
      textRevision: revision,
      listenedAt: heardAt(body, new Date()),
    });
    return NextResponse.json({ ok: true, saved });
  });
}

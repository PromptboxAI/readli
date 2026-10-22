import { NextResponse } from "next/server";
import { findCatalogBook } from "@/lib/library/catalog";
import { revisionInfo } from "@/lib/library/revisions";
import { jsonBody, withFamily } from "@/lib/family/http";
import { saveChildProgress } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Saves this child's own place and narrator in a book: { bookSlug, sentence, voiceId, textRevision? }, where the place counts in that text. */
export async function PUT(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { bookSlug, sentence, voiceId, textRevision } = await jsonBody(req);
  if (typeof bookSlug !== "string" || !findCatalogBook(bookSlug) || !Number.isInteger(sentence) || (sentence as number) < 0 || (voiceId !== null && typeof voiceId !== "string")) {
    return fail(400, "bad_request", "That page doesn't exist.");
  }
  const revision = typeof textRevision === "string" && revisionInfo(bookSlug, textRevision) ? textRevision : null;
  return withFamily(async ({ store, actor }) => {
    await saveChildProgress(store, actor, { childId, bookSlug, sentence: sentence as number, voiceId: voiceId as string | null, textRevision: revision });
    return NextResponse.json({ ok: true });
  });
}

import { NextResponse } from "next/server";
import { findCatalogBook } from "@/lib/library/catalog";
import { jsonBody, withFamily } from "@/lib/family/http";
import { saveChildProgress } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Saves this child's own place and narrator in a book: { bookSlug, sentence, voiceId }. */
export async function PUT(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { bookSlug, sentence, voiceId } = await jsonBody(req);
  if (typeof bookSlug !== "string" || !findCatalogBook(bookSlug) || !Number.isInteger(sentence) || (sentence as number) < 0 || (voiceId !== null && typeof voiceId !== "string")) {
    return fail(400, "bad_request", "That page doesn't exist.");
  }
  return withFamily(async ({ store, actor }) => {
    await saveChildProgress(store, actor, { childId, bookSlug, sentence: sentence as number, voiceId: voiceId as string | null });
    return NextResponse.json({ ok: true });
  });
}

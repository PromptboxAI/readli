import { NextResponse } from "next/server";
import { findDemoBook } from "@/lib/content/demo-books";
import { sentencesOf } from "@/lib/content/sentences";
import { jsonBody, withFamily } from "@/lib/family/http";
import { authorizeNarration } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Asks for one sentence of a book in one narrator's voice. Both permission keys are checked here,
 * before anything is generated; the audio URL is checked again on every fetch.
 */
export async function POST(req: Request) {
  const { childId, voiceId, bookSlug, sentence } = await jsonBody(req);
  const book = typeof bookSlug === "string" ? findDemoBook(bookSlug) : undefined;
  const count = book?.passageText ? sentencesOf(book.passageText).length : 0;
  if (typeof childId !== "string" || typeof voiceId !== "string" || !book || !Number.isInteger(sentence)) {
    return fail(400, "bad_request", "Choose a story and a storyteller.");
  }
  if ((sentence as number) < 0 || (sentence as number) >= count) return fail(400, "bad_sentence", "That page doesn't exist.");
  return withFamily(async ({ store, actor }) => {
    const asset = await authorizeNarration(store, actor, { childId, voiceId, bookSlug: book.slug, sentence: sentence as number });
    return NextResponse.json({ assetId: asset.id, url: `/api/kids/narrations/${asset.id}` });
  });
}

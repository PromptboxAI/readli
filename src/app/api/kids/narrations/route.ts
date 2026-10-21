import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { playbackKey } from "@/lib/family/session";
import { authorizePlayback } from "@/lib/narration/narration";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * A short-lived URL for one prepared sentence in one narrator's voice. Every permission gate is
 * checked first; nothing is generated here, so the child never waits on synthesis.
 */
export async function POST(req: Request) {
  const { childId, voiceId, bookSlug, sentence, revision } = await jsonBody(req);
  if (typeof childId !== "string" || typeof voiceId !== "string" || typeof bookSlug !== "string" || !Number.isInteger(sentence)) {
    return fail(400, "bad_request", "Choose a story and a storyteller.");
  }
  return withFamily(async ({ store, actor }) =>
    NextResponse.json(await authorizePlayback(store, actor, { childId, voiceId, bookSlug, sentence: sentence as number, revision: typeof revision === "string" ? revision : undefined }, playbackKey()), {
      headers: { "cache-control": "no-store" },
    }),
  );
}

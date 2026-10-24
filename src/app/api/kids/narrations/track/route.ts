import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { playbackKey } from "@/lib/family/session";
import { authorizeChapterTrack } from "@/lib/narration/narration";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * { childId, voiceId, bookSlug, chapter, revision? }: one fully prepared chapter as a single track, with
 * where each sentence starts. Every permission gate is checked first; the track is joined from stored
 * audio, so nothing is generated and no credits are used. "not_prepared" or "track_unavailable" means
 * the player keeps playing that chapter sentence by sentence.
 */
export async function POST(req: Request) {
  const { childId, voiceId, bookSlug, chapter, revision } = await jsonBody(req);
  if (typeof childId !== "string" || typeof voiceId !== "string" || typeof bookSlug !== "string" || !Number.isInteger(chapter)) {
    return fail(400, "bad_request", "Choose a story and a storyteller.");
  }
  return withFamily(async ({ store, actor }) =>
    NextResponse.json(
      await authorizeChapterTrack(store, actor, { childId, voiceId, bookSlug, chapter: chapter as number, revision: typeof revision === "string" ? revision : undefined }, playbackKey()),
      { headers: { "cache-control": "no-store" } },
    ),
  );
}

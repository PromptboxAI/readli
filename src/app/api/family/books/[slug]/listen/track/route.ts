import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";
import { playbackKey } from "@/lib/family/session";
import { authorizeGuardianChapterTrack } from "@/lib/narration/narration";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * { voiceId, chapter, revision? }: one fully prepared chapter as a single track, for a grown-up listening
 * in the Parent Portal. Joined from stored audio only; nothing is generated here.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { voiceId, chapter, revision } = await jsonBody(req);
  if (typeof voiceId !== "string" || !Number.isInteger(chapter)) return fail(400, "bad_request", "Choose a storyteller.");
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can listen here.");
    const result = await authorizeGuardianChapterTrack(
      store,
      actor,
      { householdId, voiceId, bookSlug: slug, chapter: chapter as number, revision: typeof revision === "string" ? revision : undefined },
      playbackKey(),
    );
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  });
}

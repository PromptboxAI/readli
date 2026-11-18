import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { playbackKey } from "@/lib/family/session";
import { authorizeDownload } from "@/lib/narration/narration";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * { voiceId, bookSlug }: every chapter of a fully prepared story in one voice, for this device to keep
 * for listening offline, with how long it may play before checking in again. The same permission gates
 * as playing it are checked first; "not_prepared" means some of the story isn't ready in that voice.
 */
export async function POST(req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const { voiceId, bookSlug } = await jsonBody(req);
  if (typeof voiceId !== "string" || typeof bookSlug !== "string") return fail(400, "bad_request", "Choose a story and a storyteller.");
  return withFamily(async ({ store, actor }) =>
    NextResponse.json(await authorizeDownload(store, actor, { childId, voiceId, bookSlug }, playbackKey()), { headers: { "cache-control": "no-store" } }),
  );
}

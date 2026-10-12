import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { myVoices, setNewStoriesPaused } from "@/lib/family/service";
import { stopVoiceNarration } from "@/lib/narration/narration";
import { fail } from "@/lib/server/http";
import { retireIfUnused } from "@/lib/voice/retire-unused";

export const dynamic = "force-dynamic";

/**
 * "Stop sharing my voice" (action B): { paused: true } withdraws authorization for new stories in every
 * family. Narration still being prepared stops (unused credits go back) and the clone is retired; stories
 * already prepared keep playing. { paused: false } allows new stories again.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ voiceId: string }> }) {
  const { voiceId } = await params;
  const { paused } = await jsonBody(req);
  if (typeof paused !== "boolean") return fail(400, "bad_request", "Choose whether new stories are allowed.");
  return withFamily(async ({ store, actor, session }) => {
    await setNewStoriesPaused(store, actor, voiceId, paused);
    const stoppedJobs = paused ? await stopVoiceNarration(store, voiceId) : 0;
    const cloneRetired = paused ? await retireIfUnused(store, voiceId, Boolean(session.account)) : false;
    return NextResponse.json({ paused, stoppedJobs, cloneRetired, voices: await myVoices(store, actor) });
  });
}

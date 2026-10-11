import { serverConfig } from "@/lib/server/config";
import { fail } from "@/lib/server/http";
import { AccountVoiceError, accountVoiceDeps, accountVoiceSample } from "@/lib/voice/account-voices";
import { voiceOwner } from "@/lib/voice/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A short line in the signed-in grown-up's own voice, so they can check it before sharing it. */
export async function POST() {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return fail(503, "voices_off", "Readli voices aren't switched on here yet.");
  const owner = await voiceOwner("Please sign in to hear your voice.");
  if ("error" in owner) return owner.error;
  try {
    const sample = await accountVoiceSample(deps, owner.user.id);
    return new Response(sample.audio, {
      headers: { "content-type": sample.contentType, "cache-control": "no-store", "x-readli-stand-in": sample.standIn ? "1" : "0" },
    });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

import { NextResponse } from "next/server";
import { currentAdult } from "@/lib/auth/adult";
import { serverConfig } from "@/lib/server/config";
import { fail } from "@/lib/server/http";
import { recordVoiceEvent } from "@/lib/server/voice-analytics";
import { AccountVoiceError, accountVoiceDeps, switchVoiceModel } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";

/** Moves the signed-in grown-up's voice to the newest reading model. Prepared books keep their audio. */
export async function POST() {
  const config = serverConfig();
  const deps = accountVoiceDeps(config);
  if (!deps) return fail(503, "voices_off", "Readli voices aren't switched on here yet.");
  const user = await currentAdult();
  if (!user) return fail(401, "sign_in_required", "Please sign in to update your voice.");
  try {
    const voice = await switchVoiceModel(deps, user.id);
    await recordVoiceEvent(config, { name: "voice_model_switched", userId: user.id, properties: { model: voice.modelId } });
    return NextResponse.json({ voice });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

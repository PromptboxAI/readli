import { NextResponse } from "next/server";
import { currentAdult } from "@/lib/auth/adult";
import { accountDb } from "@/lib/family/account-store";
import { track } from "@/lib/invitations/server";
import { shareKeptVoice } from "@/lib/invites/share-on-keep";
import { serverConfig } from "@/lib/server/config";
import { fail } from "@/lib/server/http";
import { recordVoiceEvent } from "@/lib/server/voice-analytics";
import { AccountVoiceError, accountVoiceDeps, keepVoiceCandidate } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";

/** "Keep my voice": the new recording becomes the grown-up's voice, replacing the old one. */
export async function POST() {
  const config = serverConfig();
  const deps = accountVoiceDeps(config);
  if (!deps) return fail(503, "voices_off", "Readli voices aren't switched on here yet.");
  const user = await currentAdult();
  if (!user) return fail(401, "sign_in_required", "Please sign in to keep your voice.");
  try {
    const voice = await keepVoiceCandidate(deps, { id: user.id, name: user.name });
    const db = accountDb();
    if (db && voice.version === 1) await track(db, "contributor_voice_created", {}, user.id);
    await recordVoiceEvent(config, { name: "voice_kept", userId: user.id, properties: { surface: "account", version: voice.version } });
    // An invited storyteller's families get the voice as soon as it's kept.
    const sharedWith = await shareKeptVoice();
    return NextResponse.json({ voice, sharedWith });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

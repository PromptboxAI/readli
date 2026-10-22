import { NextResponse } from "next/server";
import { accountDb } from "@/lib/family/account-store";
import { track } from "@/lib/invitations/server";
import { serverConfig } from "@/lib/server/config";
import { fail } from "@/lib/server/http";
import { recordVoiceEvent } from "@/lib/server/voice-analytics";
import { AccountVoiceError, accountVoiceDeps, keepVoiceCandidate } from "@/lib/voice/account-voices";
import { voiceOwner } from "@/lib/voice/owner";

export const dynamic = "force-dynamic";

/** "Keep my voice": the new recording becomes the grown-up's voice, replacing the old one. */
export async function POST() {
  const config = serverConfig();
  const deps = accountVoiceDeps(config);
  if (!deps) return fail(503, "voices_off", "Readli voices aren't switched on here yet.");
  const owner = await voiceOwner("Please sign in to keep your voice.");
  if ("error" in owner) return owner.error;
  const user = owner.user;
  try {
    const voice = await keepVoiceCandidate(deps, { id: user.id, name: user.name });
    const db = accountDb();
    if (db && voice.version === 1) await track(db, "contributor_voice_created", {}, user.id);
    await recordVoiceEvent(config, { name: "voice_kept", userId: user.id, properties: { surface: "account", version: voice.version } });
    return NextResponse.json({ voice });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

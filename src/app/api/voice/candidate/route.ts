import { NextResponse } from "next/server";
import { serverConfig } from "@/lib/server/config";
import { fail } from "@/lib/server/http";
import { recordVoiceEvent } from "@/lib/server/voice-analytics";
import { accountVoiceDeps, discardVoiceCandidate } from "@/lib/voice/account-voices";
import { voiceOwner } from "@/lib/voice/owner";

export const dynamic = "force-dynamic";

/** Throws away a new recording the grown-up didn't like. Their current voice carries on unchanged. */
export async function DELETE() {
  const config = serverConfig();
  const deps = accountVoiceDeps(config);
  if (!deps) return fail(503, "voices_off", "Readli voices aren't switched on here yet.");
  const owner = await voiceOwner("Please sign in first.");
  if ("error" in owner) return owner.error;
  const user = owner.user;
  const had = await deps.store.findCandidate(user.id);
  await discardVoiceCandidate(deps, user.id);
  if (had) await recordVoiceEvent(config, { name: "voice_discarded", userId: user.id, properties: { surface: "account" } });
  return NextResponse.json({ discarded: Boolean(had) });
}

import { NextResponse } from "next/server";
import { currentAdult } from "@/lib/auth/adult";
import { serverConfig } from "@/lib/server/config";
import { fail } from "@/lib/server/http";
import { recordVoiceEvent } from "@/lib/server/voice-analytics";
import { accountVoiceDeps, discardVoiceCandidate } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";

/** Throws away a new recording the grown-up didn't like. Their current voice carries on unchanged. */
export async function DELETE() {
  const config = serverConfig();
  const deps = accountVoiceDeps(config);
  if (!deps) return fail(503, "voices_off", "Readli voices aren't switched on here yet.");
  const user = await currentAdult();
  if (!user) return fail(401, "sign_in_required", "Please sign in first.");
  const had = await deps.store.findCandidate(user.id);
  await discardVoiceCandidate(deps, user.id);
  if (had) await recordVoiceEvent(config, { name: "voice_discarded", userId: user.id, properties: { surface: "account" } });
  return NextResponse.json({ discarded: Boolean(had) });
}

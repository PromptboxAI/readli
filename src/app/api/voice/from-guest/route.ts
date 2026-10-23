import { NextResponse } from "next/server";
import { currentAdult } from "@/lib/auth/adult";
import { serverConfig } from "@/lib/server/config";
import { currentGuest, guestDemoDeps } from "@/lib/server/guest-demo";
import { fail } from "@/lib/server/http";
import { recordVoiceEvent } from "@/lib/server/voice-analytics";
import { AccountVoiceError, accountVoiceDeps } from "@/lib/voice/account-voices";
import { createVoiceCandidateFromGuest } from "@/lib/voice/guest-handoff";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Turns the take this browser recorded on /try into a voice candidate for the signed-in grown-up,
 * so they don't read the story again. Same consent and checks as POST /api/voice.
 */
export async function POST(req: Request) {
  const config = serverConfig();
  const deps = accountVoiceDeps(config);
  if (!deps) return fail(503, "voices_off", "Readli voices aren't switched on here yet.");
  const user = await currentAdult();
  if (!user) return fail(401, "sign_in_required", "Please sign in to make your Readli voice.");
  const guestDeps = guestDemoDeps(config);
  if (!guestDeps) return fail(410, "guest_take_gone", "Your earlier recording isn't here anymore. Please record your voice again.");

  const body = (await req.json().catch(() => null)) as { consents?: unknown; removeBackgroundNoise?: unknown } | null;
  const consents = Array.isArray(body?.consents) ? body.consents.filter((c): c is string => typeof c === "string") : [];
  const removeBackgroundNoise = body?.removeBackgroundNoise === true;
  try {
    const guest = await currentGuest(guestDeps);
    const candidate = await createVoiceCandidateFromGuest(deps, guestDeps.store, guest, { id: user.id, name: user.name }, { consents, removeBackgroundNoise });
    await recordVoiceEvent(config, { name: "voice_cloned", userId: user.id, properties: { surface: "account", removeBackgroundNoise, fromGuest: true } });
    return NextResponse.json({ candidate: { id: candidate.id, createdAt: candidate.createdAt } }, { status: 201 });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

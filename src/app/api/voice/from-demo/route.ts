import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/supabase";
import { serverConfig } from "@/lib/server/config";
import { currentGuest, guestDemoDeps } from "@/lib/server/guest-demo";
import { fail } from "@/lib/server/http";
import { AccountVoiceError, accountVoiceDeps } from "@/lib/voice/account-voices";
import { NO_DEMO_RECORDING, voiceFromDemo } from "@/lib/voice/demo-voice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Whether this browser still has a demo take the signed-in grown-up could turn into their voice. */
export async function GET() {
  const guests = guestDemoDeps();
  const guest = guests ? await currentGuest(guests) : null;
  const available = !!guest && !!accountVoiceDeps(serverConfig()) && !!(await currentUser()) && !!(await guests!.store.latestRecording(guest.id));
  return NextResponse.json({ available }, { headers: { "cache-control": "no-store" } });
}

/** Makes (or replaces) the signed-in grown-up's voice from their demo take, with their consent. */
export async function POST(req: Request) {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return fail(503, "voices_off", "Readli voices aren't switched on here yet.");
  const user = await currentUser();
  if (!user) return fail(401, "sign_in_required", "Please sign in to make your Readli voice.");
  const guests = guestDemoDeps();
  const guest = guests ? await currentGuest(guests) : null;
  if (!guests || !guest) return fail(404, "no_demo_recording", NO_DEMO_RECORDING);

  const body = (await req.json().catch(() => null)) as { consents?: unknown; removeBackgroundNoise?: unknown } | null;
  const consents = Array.isArray(body?.consents) ? body.consents.filter((c): c is string => typeof c === "string") : [];
  try {
    const voice = await voiceFromDemo(deps, guests.store, guest.id, { id: user.id, name: user.name }, { consents, removeBackgroundNoise: body?.removeBackgroundNoise === true });
    return NextResponse.json({ voice }, { status: 201 });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

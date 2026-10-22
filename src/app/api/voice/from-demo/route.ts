import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/supabase";
import { serverConfig } from "@/lib/server/config";
import { currentGuest, guestDemoDeps } from "@/lib/server/guest-demo";
import { fail } from "@/lib/server/http";
import { AccountVoiceError, accountVoiceDeps } from "@/lib/voice/account-voices";
import { NO_DEMO_RECORDING, voiceFromDemo } from "@/lib/voice/demo-voice";
import { voiceOwner } from "@/lib/voice/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Whether this browser still has a demo take the signed-in grown-up could turn into their voice. */
export async function GET() {
  const guests = guestDemoDeps();
  const guest = guests ? await currentGuest(guests) : null;
  const available = !!guest && !!accountVoiceDeps(serverConfig()) && !!(await currentUser()) && !!(await guests!.store.latestRecording(guest.id));
  return NextResponse.json({ available }, { headers: { "cache-control": "no-store" } });
}

/** Makes a new voice candidate from the signed-in grown-up's demo take, under the agreement they just accepted. */
export async function POST(req: Request) {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return fail(503, "voices_off", "Readli voices aren't switched on here yet.");
  const owner = await voiceOwner("Please sign in to make your Readli voice.");
  if ("error" in owner) return owner.error;
  const user = owner.user;
  const guests = guestDemoDeps();
  const guest = guests ? await currentGuest(guests) : null;
  if (!guests || !guest) return fail(404, "no_demo_recording", NO_DEMO_RECORDING);

  const body = (await req.json().catch(() => null)) as { agreementId?: unknown; removeBackgroundNoise?: unknown } | null;
  try {
    const candidate = await voiceFromDemo(deps, guests.store, guest.id, { id: user.id, name: user.name }, {
      agreementId: typeof body?.agreementId === "string" ? body.agreementId : null,
      removeBackgroundNoise: body?.removeBackgroundNoise === true,
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ candidate: { id: candidate.id, createdAt: candidate.createdAt } }, { status: 201 });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

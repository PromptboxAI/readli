import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/supabase";
import { serverConfig } from "@/lib/server/config";
import { fail } from "@/lib/server/http";
import { AccountVoiceError, accountVoiceDeps, createAccountVoice, deleteAccountVoice } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VOICES_OFF = "Readli voices aren't switched on here yet.";
const SIGN_IN = "Please sign in to make your Readli voice.";
const DEVICE_CLASSES = ["phone", "tablet", "desktop"] as const;

function intOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return v === null || v === "" || !Number.isFinite(n) ? null : Math.round(n);
}

/** The signed-in grown-up's own voice, without anything provider-side. */
export async function GET() {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return fail(503, "voices_off", VOICES_OFF);
  const user = await currentUser();
  if (!user) return fail(401, "sign_in_required", SIGN_IN);
  const voice = await deps.store.findVoice(user.id);
  return NextResponse.json({ voice: voice ? { id: voice.id, status: voice.status, version: voice.version, updatedAt: voice.updatedAt } : null }, { headers: { "cache-control": "no-store" } });
}

/** Records consent, saves the take privately, clones it and saves (or replaces) the grown-up's voice. */
export async function POST(req: Request) {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return fail(503, "voices_off", VOICES_OFF);
  const user = await currentUser();
  if (!user) return fail(401, "sign_in_required", SIGN_IN);

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!form || !(audio instanceof Blob)) return fail(400, "no_audio", "We didn't get your recording. Please try again.");
  const device = form.get("deviceClass");
  try {
    const voice = await createAccountVoice(deps, { id: user.id, name: user.name }, {
      audio,
      durationMs: Number(form.get("durationMs")),
      wpm: intOrNull(form.get("wpm")),
      pauseCount: intOrNull(form.get("pauseCount")) ?? 0,
      deviceClass: DEVICE_CLASSES.find((d) => d === device) ?? null,
      scriptOffsetEnd: intOrNull(form.get("scriptOffsetEnd")),
      consents: form.getAll("consent").filter((c): c is string => typeof c === "string"),
      removeBackgroundNoise: form.get("removeBackgroundNoise") === "true",
    });
    return NextResponse.json({ voice }, { status: 201 });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

/** Deletes the grown-up's voice everywhere. They can record a new one at any time. */
export async function DELETE() {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return fail(503, "voices_off", VOICES_OFF);
  const user = await currentUser();
  if (!user) return fail(401, "sign_in_required", "Please sign in to delete your voice.");
  try {
    await deleteAccountVoice(deps, user.id);
    return NextResponse.json({ voice: null });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

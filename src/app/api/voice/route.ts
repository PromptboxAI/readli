import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/supabase";
import { serverConfig } from "@/lib/server/config";
import { fail } from "@/lib/server/http";
import { recordVoiceEvent } from "@/lib/server/voice-analytics";
import { AccountVoiceError, accountVoiceDeps, createVoiceCandidate, deleteAccountVoice } from "@/lib/voice/account-voices";

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

/**
 * Records consent, saves the take privately and clones it into a candidate the grown-up listens to.
 * Their current voice stays in use until they keep the candidate (POST /api/voice/keep).
 */
export async function POST(req: Request) {
  const config = serverConfig();
  const deps = accountVoiceDeps(config);
  if (!deps) return fail(503, "voices_off", VOICES_OFF);
  const user = await currentUser();
  if (!user) return fail(401, "sign_in_required", SIGN_IN);

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!form || !(audio instanceof Blob)) return fail(400, "no_audio", "We didn't get your recording. Please try again.");
  const device = form.get("deviceClass");
  const durationMs = Number(form.get("durationMs"));
  const removeBackgroundNoise = form.get("removeBackgroundNoise") === "true";
  try {
    const candidate = await createVoiceCandidate(deps, { id: user.id, name: user.name }, {
      audio,
      durationMs,
      wpm: intOrNull(form.get("wpm")),
      pauseCount: intOrNull(form.get("pauseCount")) ?? 0,
      deviceClass: DEVICE_CLASSES.find((d) => d === device) ?? null,
      scriptOffsetEnd: intOrNull(form.get("scriptOffsetEnd")),
      consents: form.getAll("consent").filter((c): c is string => typeof c === "string"),
      removeBackgroundNoise,
    });
    const deviceClass = DEVICE_CLASSES.find((d) => d === device) ?? null;
    await recordVoiceEvent(config, {
      name: "recording_submitted",
      userId: user.id,
      properties: {
        surface: "account",
        durationMs: Math.round(durationMs),
        afterFeedback: form.get("afterFeedback") === "true",
        qcIssues: form.getAll("qcIssue").filter((i): i is string => typeof i === "string").slice(0, 6),
        deviceClass,
      },
    });
    await recordVoiceEvent(config, { name: "voice_cloned", userId: user.id, properties: { surface: "account", removeBackgroundNoise } });
    return NextResponse.json({ candidate: { id: candidate.id, createdAt: candidate.createdAt } }, { status: 201 });
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

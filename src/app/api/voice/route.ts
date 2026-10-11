import { NextResponse } from "next/server";
import { serverConfig } from "@/lib/server/config";
import { fail } from "@/lib/server/http";
import { AccountVoiceError, accountVoiceDeps, createAccountVoice, deleteAccountVoice } from "@/lib/voice/account-voices";
import { voiceOwner } from "@/lib/voice/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VOICES_OFF = "Readli voices aren't switched on here yet.";
const SIGN_IN = "Please sign in to make your Readli voice.";
const DEVICE_CLASSES = ["phone", "tablet", "desktop"] as const;

function intOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return v === null || v === "" || !Number.isFinite(n) ? null : Math.round(n);
}

/** The recorder's own checks, if sent: speech time and any issues it noticed. */
function parseQc(v: FormDataEntryValue | null): { speechMs: number | null; issues: string[] } | null {
  if (typeof v !== "string") return null;
  try {
    const raw = JSON.parse(v) as { speechMs?: unknown; issues?: unknown };
    const speechMs = typeof raw.speechMs === "number" && Number.isFinite(raw.speechMs) ? Math.round(raw.speechMs) : null;
    const issues = Array.isArray(raw.issues) ? raw.issues.filter((i): i is string => typeof i === "string").slice(0, 10).map((i) => i.slice(0, 40)) : [];
    return { speechMs, issues };
  } catch {
    return null;
  }
}

/** The signed-in grown-up's own voice, without anything provider-side. */
export async function GET() {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return fail(503, "voices_off", VOICES_OFF);
  const owner = await voiceOwner(SIGN_IN);
  if ("error" in owner) return owner.error;
  const voice = await deps.store.findVoice(owner.user.id);
  return NextResponse.json({ voice: voice ? { id: voice.id, status: voice.status, version: voice.version, updatedAt: voice.updatedAt } : null }, { headers: { "cache-control": "no-store" } });
}

/** Checks the agreement accepted before recording, saves the take privately, clones it and saves (or replaces) the grown-up's voice. */
export async function POST(req: Request) {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return fail(503, "voices_off", VOICES_OFF);
  const owner = await voiceOwner(SIGN_IN);
  if ("error" in owner) return owner.error;
  const user = owner.user;

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
      agreementId: typeof form.get("agreementId") === "string" ? (form.get("agreementId") as string) : null,
      removeBackgroundNoise: form.get("removeBackgroundNoise") === "true",
      qc: parseQc(form.get("qc")),
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    });
    return NextResponse.json({ voice }, { status: 201 });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

/**
 * Deletes (withdraws) the grown-up's voice: no new stories in it, its clone retired, unfinished
 * narration stopped with credits returned, its recordings out of training. Stories already prepared
 * keep playing for the families it was shared with. They can record a new one at any time.
 */
export async function DELETE() {
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return fail(503, "voices_off", VOICES_OFF);
  const owner = await voiceOwner("Please sign in to delete your voice.");
  if ("error" in owner) return owner.error;
  try {
    const result = await deleteAccountVoice(deps, owner.user.id);
    return NextResponse.json({ voice: null, stoppedJobs: result.stoppedJobs });
  } catch (err) {
    if (err instanceof AccountVoiceError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

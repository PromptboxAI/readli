import { NextResponse } from "next/server";
import { currentGuest, effectiveMode, guestDemoDeps } from "@/lib/server/guest-demo";
import { fail, NO_SESSION, PREVIEWS_OFF } from "@/lib/server/http";
import { checkUpload, SERVER_QC_MESSAGES } from "@/lib/server/recording-qc";
import { recordVoiceEvent } from "@/lib/server/voice-analytics";

export const dynamic = "force-dynamic";

const DEVICE_CLASSES = ["phone", "tablet", "desktop"] as const;

function intOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return v === null || !Number.isFinite(n) ? null : Math.round(n);
}

/** Receives a finished guest take, runs authoritative server QC and stores it privately. */
export async function POST(req: Request) {
  const deps = guestDemoDeps();
  if ((await effectiveMode(deps)) === "off" || !deps) return fail(503, "previews_off", PREVIEWS_OFF);
  const guest = await currentGuest(deps);
  if (!guest) return fail(401, "no_session", NO_SESSION);

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!form || !(audio instanceof Blob)) return fail(400, "no_audio", SERVER_QC_MESSAGES.empty);

  const durationMs = Number(form.get("durationMs"));
  const issues = checkUpload({ mimeType: audio.type, bytes: audio.size, durationMs }, deps.config);
  if (issues.length > 0) return fail(422, issues[0]!, SERVER_QC_MESSAGES[issues[0]!]);

  const device = form.get("deviceClass");
  const { recordingId } = await deps.store.saveRecording(guest.id, audio, {
    durationMs,
    mimeType: audio.type,
    teleprompterWpm: intOrNull(form.get("wpm")),
    pauseCount: intOrNull(form.get("pauseCount")) ?? 0,
    deviceClass: DEVICE_CLASSES.find((d) => d === device) ?? null,
    scriptOffsetEnd: intOrNull(form.get("scriptOffsetEnd")),
  });
  await recordVoiceEvent(deps.config, {
    name: "recording_submitted",
    guestSessionId: guest.id,
    properties: {
      surface: "guest",
      durationMs: Math.round(durationMs),
      wpm: intOrNull(form.get("wpm")),
      takeNumber: intOrNull(form.get("takeNumber")),
      afterFeedback: form.get("afterFeedback") === "true",
      qcIssues: form.getAll("qcIssue").filter((i): i is string => typeof i === "string").slice(0, 6),
      deviceClass: DEVICE_CLASSES.find((d) => d === device) ?? null,
    },
  });
  return NextResponse.json({ recordingId }, { status: 201 });
}

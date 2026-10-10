import { NextResponse } from "next/server";
import { currentGuest, effectiveMode, guestDemoDeps } from "@/lib/server/guest-demo";
import { fail, NO_SESSION, PREVIEWS_OFF } from "@/lib/server/http";
import { fileExtension } from "@/lib/audio/mime";
import { VoiceProviderError } from "@/lib/voice/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Each guest may make a few voices (retakes), never unlimited provider voice slots. */
const MAX_VOICES_PER_GUEST = 3;

/** Turns the guest's latest take into an instant voice clone. No stock voice is ever substituted. */
export async function POST() {
  const deps = guestDemoDeps();
  if ((await effectiveMode(deps)) === "off" || !deps) return fail(503, "previews_off", PREVIEWS_OFF);
  const guest = await currentGuest(deps);
  if (!guest) return fail(401, "no_session", NO_SESSION);

  const recording = await deps.store.latestRecording(guest.id);
  if (!recording) return fail(409, "no_recording", "Record your voice first, then pick a story.");
  if ((await deps.store.voiceCount(guest.id)) >= MAX_VOICES_PER_GUEST) {
    return fail(429, "too_many_voices", "You've made a few voices already. Pick a story to hear the latest one.");
  }

  const previous = await deps.store.getVoice(guest.id);
  try {
    const { voiceId } = await deps.provider.createInstantVoice({
      name: `Readli guest ${guest.id.slice(0, 8)}`,
      audio: recording.audio,
      filename: `take.${fileExtension(recording.mimeType)}`,
      description: "Readli guest demo voice. Deleted automatically within 24 hours.",
    });
    await deps.store.setVoice(guest.id, voiceId);
  } catch (err) {
    console.error("clone failed", err);
    const message = err instanceof VoiceProviderError ? err.userMessage : "We couldn't make your voice just now. Please try again.";
    return fail(502, "clone_failed", message);
  }
  // A retake replaces the earlier clone; remove the old one from the provider straight away.
  if (previous) await deps.provider.deleteVoice(previous).catch((err) => console.error("old voice delete failed", err));

  return NextResponse.json({ status: "ready" }, { status: 201 });
}

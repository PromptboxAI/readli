import type { GuestStore } from "@/lib/server/guest-store";
import { AccountVoiceError, createVoiceCandidate, type AccountVoiceDeps, type VoiceCandidate } from "./account-voices";

export const NO_DEMO_RECORDING = "We couldn't find your demo recording. Demo recordings are deleted after 24 hours, so please record again.";

/**
 * Makes a candidate Readli voice (kept with "Keep my voice", like a new recording) from the take they recorded in the guest demo, on the same
 * browser, before it's deleted. Everything an account voice needs still applies: the Voice Recording
 * & AI Training Agreement accepted first, a real minute of audio, and the usual checks. The take was
 * recorded before that agreement, so it is kept as a guest-demo carry-over: used to make and remake the
 * voice, never for training or licensing. The guest copy is still deleted on its schedule.
 */
export async function voiceFromDemo(
  deps: AccountVoiceDeps,
  guests: GuestStore,
  guestId: string,
  owner: { id: string; name: string },
  input: { agreementId: string | null; removeBackgroundNoise: boolean; userAgent: string | null },
): Promise<VoiceCandidate> {
  const recording = await guests.latestRecording(guestId);
  if (!recording) throw new AccountVoiceError(404, "no_demo_recording", NO_DEMO_RECORDING);
  return createVoiceCandidate(deps, owner, {
    audio: new Blob([recording.audio], { type: recording.mimeType }),
    durationMs: recording.durationMs ?? 0,
    wpm: null,
    pauseCount: 0,
    deviceClass: null,
    scriptOffsetEnd: null,
    agreementId: input.agreementId,
    removeBackgroundNoise: input.removeBackgroundNoise,
    qc: null,
    userAgent: input.userAgent,
    origin: "guest_demo",
  });
}

import type { GuestSession, GuestStore } from "@/lib/server/guest-store";
import { baseMimeType } from "@/lib/server/recording-qc";
import { AccountVoiceError, createVoiceCandidate, type AccountVoiceDeps, type VoiceCandidate } from "./account-voices";

/** The /try take a newly signed-in grown-up can turn into their Readli voice instead of reading again. */
export interface GuestTake {
  durationMs: number;
  /** When the guest copy is deleted. After this the take can't be used. */
  expiresAt: string;
}

export async function findGuestTake(store: GuestStore, guest: GuestSession | null): Promise<GuestTake | null> {
  if (!guest) return null;
  const meta = await store.latestRecordingMeta(guest.id);
  return meta ? { durationMs: meta.durationMs, expiresAt: guest.expiresAt } : null;
}

/**
 * Makes a voice candidate from the guest's saved take. The account's own consent is still required:
 * the guest only agreed to a private 24-hour preview. The account keeps its own copy of the audio, so
 * the guest copy is deleted on its usual schedule.
 */
export async function createVoiceCandidateFromGuest(
  deps: AccountVoiceDeps,
  store: GuestStore,
  guest: GuestSession | null,
  owner: { id: string; name: string },
  choice: { consents: readonly string[]; removeBackgroundNoise: boolean },
): Promise<VoiceCandidate> {
  const recording = guest ? await store.latestRecording(guest.id) : null;
  const meta = guest && recording ? await store.latestRecordingMeta(guest.id) : null;
  if (!recording || !meta) {
    throw new AccountVoiceError(410, "guest_take_gone", "Your earlier recording isn't here anymore. Please record your voice again.");
  }
  const mimeType = baseMimeType(recording.mimeType);
  return createVoiceCandidate(deps, owner, {
    audio: recording.audio.type === mimeType ? recording.audio : new Blob([recording.audio], { type: mimeType }),
    durationMs: meta.durationMs,
    wpm: meta.teleprompterWpm,
    pauseCount: meta.pauseCount,
    deviceClass: meta.deviceClass,
    scriptOffsetEnd: meta.scriptOffsetEnd,
    consents: choice.consents,
    removeBackgroundNoise: choice.removeBackgroundNoise,
  });
}

/**
 * VoiceProvider adapter (PRD §7). Readli runs one ElevenLabs business account; the server maps each
 * provider voice to its owner and enforces permissions, so nothing here is ever called from the browser.
 */
export interface SynthesizedAudio {
  audio: ArrayBuffer;
  contentType: string;
  /** True for stand-in audio that is not the guest's voice (stub mode only). */
  standIn: boolean;
}

export interface VoiceProvider {
  createInstantVoice(input: { name: string; audio: Blob; filename: string; description: string }): Promise<{ voiceId: string }>;
  synthesize(input: { voiceId: string; text: string }): Promise<SynthesizedAudio>;
  deleteVoice(voiceId: string): Promise<void>;
}

export class VoiceProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Safe to show the guest; never includes provider details. */
    readonly userMessage = "We couldn't make your voice preview just now. Please try again in a moment.",
  ) {
    super(message);
  }
}

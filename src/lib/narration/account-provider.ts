import { ensureClone, providerVoiceId, type AccountVoiceDeps } from "@/lib/voice/account-voices";
import type { SynthesizedAudio, VoiceProvider } from "@/lib/voice/provider";

/**
 * Narration for real families: looks up the provider voice behind a Readli voice on the server, then
 * asks the provider to read the sentence. A clone retired while no Readli Family household needed it
 * is re-made from the original recording first, if the owner's authorization is still valid. The
 * provider voice id never leaves the server.
 */
export class AccountNarrationProvider implements VoiceProvider {
  constructor(private readonly deps: AccountVoiceDeps) {}

  async createInstantVoice(): Promise<{ voiceId: string }> {
    throw new Error("voices are made by the recording flow");
  }

  async synthesize(input: { voiceId: string; text: string }): Promise<SynthesizedAudio> {
    const id = (await providerVoiceId(this.deps, input.voiceId)) ?? (await ensureClone(this.deps, input.voiceId));
    return this.deps.provider.synthesize({ voiceId: id, text: input.text });
  }

  async deleteVoice(): Promise<void> {}
}

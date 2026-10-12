import { providerVoiceId, type AccountVoiceDeps } from "@/lib/voice/account-voices";
import type { SynthesizedAudio, VoiceProvider } from "@/lib/voice/provider";

/**
 * Narration for real families: looks up the provider voice behind a Readli voice on the server, then
 * asks the provider to read the sentence. The provider voice id never leaves the server.
 */
export class AccountNarrationProvider implements VoiceProvider {
  constructor(private readonly deps: AccountVoiceDeps) {}

  async createInstantVoice(): Promise<{ voiceId: string }> {
    throw new Error("voices are made by the recording flow");
  }

  async synthesize(input: { voiceId: string; text: string; modelId?: string }): Promise<SynthesizedAudio> {
    const id = await providerVoiceId(this.deps, input.voiceId);
    if (!id) throw new Error("voice not ready");
    return this.deps.provider.synthesize({ voiceId: id, text: input.text, modelId: input.modelId });
  }

  async deleteVoice(): Promise<void> {}
}

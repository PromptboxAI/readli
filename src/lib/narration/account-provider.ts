import { providerVoiceId, type AccountVoiceDeps } from "@/lib/voice/account-voices";
import { voiceRefusedError, type SynthesizedAudio, type VoiceProvider } from "@/lib/voice/provider";
import { alertVoiceRefused } from "@/lib/voice/refused-alert";

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
    try {
      return await this.deps.provider.synthesize({ voiceId: id, text: input.text, modelId: input.modelId });
    } catch (err) {
      // The family is asked to record again; Readli's admins hear about it too.
      if (voiceRefusedError(err)) await alertVoiceRefused({ label: `Readli voice ${input.voiceId}`, key: input.voiceId, where: "narration", error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  async deleteVoice(): Promise<void> {}
}

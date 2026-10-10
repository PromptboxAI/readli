import { VoiceProviderError, type SynthesizedAudio, type VoiceProvider } from "./provider";

const API = "https://api.elevenlabs.io/v1";

/** ElevenLabs Instant Voice Cloning + text to speech. Requires a paid plan for cloning. */
export class ElevenLabsProvider implements VoiceProvider {
  constructor(
    private readonly apiKey: string,
    private readonly modelId: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(path: string, init: RequestInit): Promise<Response> {
    const res = await this.fetchImpl(`${API}${path}`, { ...init, headers: { "xi-api-key": this.apiKey, ...init.headers } });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new VoiceProviderError(`ElevenLabs ${init.method ?? "GET"} ${path} failed: ${res.status} ${detail.slice(0, 300)}`, res.status);
    }
    return res;
  }

  async createInstantVoice({ name, audio, filename, description }: { name: string; audio: Blob; filename: string; description: string }) {
    const form = new FormData();
    form.append("name", name);
    form.append("description", description);
    form.append("files", audio, filename);
    // ElevenLabs "enhance": most takes come from phones in echoey rooms, often recorded by grandparents.
    form.append("remove_background_noise", "true");
    form.append("labels", JSON.stringify({ source: "readli_guest_demo" }));
    const res = await this.call("/voices/add", { method: "POST", body: form });
    const json = (await res.json()) as { voice_id?: string };
    if (!json.voice_id) throw new VoiceProviderError("ElevenLabs returned no voice_id", 502);
    return { voiceId: json.voice_id };
  }

  async synthesize({ voiceId, text }: { voiceId: string; text: string }): Promise<SynthesizedAudio> {
    const res = await this.call(`/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: this.modelId }),
    });
    return { audio: await res.arrayBuffer(), contentType: "audio/mpeg", standIn: false };
  }

  async deleteVoice(voiceId: string) {
    try {
      await this.call(`/voices/${encodeURIComponent(voiceId)}`, { method: "DELETE" });
    } catch (err) {
      // Already gone counts as deleted.
      if (err instanceof VoiceProviderError && err.status === 404) return;
      throw err;
    }
  }
}

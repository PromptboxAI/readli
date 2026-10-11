import { VoiceProviderError, type SynthesizedAudio, type VoiceProvider } from "./provider";

const API = "https://api.elevenlabs.io/v1";

/**
 * Sent with every story read. ElevenLabs suggests stability 0.5, similarity 0.75 and style 0 as a
 * start; stability sits a little lower because higher values read flat and robotic for storytime,
 * and similarity a little higher with speaker boost so the clone stays close to the parent.
 * Style exaggeration stays 0: ElevenLabs advises it, as it adds latency and makes voices less stable.
 */
export const VOICE_SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0, use_speaker_boost: true } as const;

/** Readli reads with ElevenLabs' newest model (Kevin, 2026-10-11: don't fall models behind). */
export const DEFAULT_MODEL = "eleven_v4";
/** Used for a read when the newest model rejects the request, so stories keep playing. */
export const FALLBACK_MODEL = "eleven_multilingual_v2";

/**
 * Eleven v4 only has the stability and similarity sliders (style and speed aren't available), so
 * it gets just those two, at the same values.
 */
export function voiceSettings(modelId: string) {
  if (modelId.startsWith("eleven_v4")) return { stability: VOICE_SETTINGS.stability, similarity_boost: VOICE_SETTINGS.similarity_boost };
  return VOICE_SETTINGS;
}

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

  async createInstantVoice({
    name,
    audio,
    filename,
    description,
    removeBackgroundNoise = true,
  }: Parameters<VoiceProvider["createInstantVoice"]>[0]) {
    const form = new FormData();
    form.append("name", name);
    form.append("description", description);
    form.append("files", audio, filename);
    // ElevenLabs "enhance": most takes come from phones in echoey rooms, often recorded by grandparents.
    // The speaker can turn it off, because the clean-up can also change how a clean voice sounds.
    form.append("remove_background_noise", String(removeBackgroundNoise));
    form.append("labels", JSON.stringify({ source: "readli_guest_demo" }));
    const res = await this.call("/voices/add", { method: "POST", body: form });
    const json = (await res.json()) as { voice_id?: string };
    if (!json.voice_id) throw new VoiceProviderError("ElevenLabs returned no voice_id", 502);
    return { voiceId: json.voice_id };
  }

  async synthesize({ voiceId, text }: { voiceId: string; text: string }): Promise<SynthesizedAudio> {
    const speak = (modelId: string) =>
      this.call(`/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: modelId, voice_settings: voiceSettings(modelId) }),
      });
    let res: Response;
    try {
      res = await speak(this.modelId);
    } catch (err) {
      // A newer model turning the request down (400/422) shouldn't silence a story: read it with the
      // previous model instead. Auth, quota and missing-voice errors still surface.
      const rejected = err instanceof VoiceProviderError && (err.status === 400 || err.status === 422);
      if (!rejected || this.modelId === FALLBACK_MODEL) throw err;
      console.warn(`ElevenLabs ${this.modelId} rejected a read, using ${FALLBACK_MODEL}: ${(err as Error).message}`);
      res = await speak(FALLBACK_MODEL);
    }
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

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
 * Server-side quality presets to compare on real voices (ELEVENLABS_VOICE_PRESET). Parents never
 * see sliders. "natural" is the default above; "closer" leans on similarity for voices that drift;
 * "expressive" lets delivery vary more for voices that come out flat.
 */
export const VOICE_PRESETS = {
  natural: { stability: 0.4, similarity_boost: 0.8 },
  closer: { stability: 0.5, similarity_boost: 0.9 },
  expressive: { stability: 0.3, similarity_boost: 0.75 },
} as const;

export type VoicePreset = keyof typeof VOICE_PRESETS;

export function activePreset(env: NodeJS.ProcessEnv = process.env): VoicePreset {
  const p = env.ELEVENLABS_VOICE_PRESET;
  return p === "closer" || p === "expressive" ? p : "natural";
}

/**
 * Eleven v4 only has the stability and similarity sliders (style and speed aren't available), so
 * it gets just those two. Older models also get style 0 and speaker boost.
 */
export function voiceSettings(modelId: string, preset: VoicePreset = activePreset()) {
  const sliders = VOICE_PRESETS[preset];
  if (modelId.startsWith("eleven_v4")) return { ...sliders };
  return { ...VOICE_SETTINGS, ...sliders };
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
    console.info(JSON.stringify({ event: "elevenlabs_clone", type: "instant", removeBackgroundNoise, bytes: audio.size }));
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
    let modelId = this.modelId;
    try {
      res = await speak(this.modelId);
    } catch (err) {
      // A newer model turning the request down (400/422) shouldn't silence a story: read it with the
      // previous model instead. Auth, quota and missing-voice errors still surface.
      const rejected = err instanceof VoiceProviderError && (err.status === 400 || err.status === 422);
      if (!rejected || this.modelId === FALLBACK_MODEL) throw err;
      console.warn(`ElevenLabs ${this.modelId} rejected a read, using ${FALLBACK_MODEL}: ${(err as Error).message}`);
      res = await speak(FALLBACK_MODEL);
      modelId = FALLBACK_MODEL;
    }
    // ElevenLabs reports what it billed; the text length is the fallback.
    const billed = Number(res.headers.get("character-cost") ?? res.headers.get("x-character-count"));
    const characters = Number.isFinite(billed) && billed > 0 ? billed : text.length;
    // One line per read so every clip can be traced to the model and settings that made it.
    console.info(JSON.stringify({ event: "elevenlabs_tts", model: modelId, preset: activePreset(), settings: voiceSettings(modelId), characters }));
    return { audio: await res.arrayBuffer(), contentType: "audio/mpeg", standIn: false, modelId, characters };
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

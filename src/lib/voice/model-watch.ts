import { DEFAULT_MODEL, FALLBACK_MODEL } from "./elevenlabs";

/**
 * ElevenLabs reading models Readli already knows about. Anything else ElevenLabs lists is shown to
 * admins as new, so we hear about a better model without watching their changelog.
 */
export const KNOWN_MODELS = new Set([
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  "eleven_v3",
  "eleven_multilingual_v1",
  "eleven_monolingual_v1",
  "eleven_english_sts_v2",
  "eleven_multilingual_sts_v2",
  "eleven_turbo_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2",
  "eleven_flash_v2_5",
  "eleven_multilingual_ttv_v2",
  "eleven_ttv_v3",
]);

export interface ProviderModel {
  id: string;
  name: string;
  description: string;
  isNew: boolean;
  inUse: boolean;
}

interface RawModel {
  model_id?: string;
  name?: string;
  description?: string;
  can_do_text_to_speech?: boolean;
}

/** Text-to-speech models ElevenLabs offers this account, newest-unknown first. */
export function readModels(raw: unknown, inUse: string): ProviderModel[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawModel[])
    .filter((m) => typeof m.model_id === "string" && m.can_do_text_to_speech !== false)
    .map((m) => ({
      id: m.model_id!,
      name: m.name ?? m.model_id!,
      description: (m.description ?? "").slice(0, 240),
      isNew: !KNOWN_MODELS.has(m.model_id!),
      inUse: m.model_id === inUse,
    }))
    .sort((a, b) => Number(b.isNew) - Number(a.isNew) || Number(b.inUse) - Number(a.inUse));
}

/** Asks ElevenLabs for its models, at most once a day per server. Null when it can't be reached. */
export async function fetchProviderModels(apiKey: string | undefined, inUse: string): Promise<ProviderModel[] | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/models", {
      headers: { "xi-api-key": apiKey },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return readModels(await res.json(), inUse);
  } catch {
    return null;
  }
}

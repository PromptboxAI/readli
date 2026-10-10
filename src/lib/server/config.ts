/**
 * Server-only configuration for the guest demo backend. Never import from client components:
 * it reads the service role and ElevenLabs keys.
 *
 * Modes:
 * - live: Supabase + ElevenLabs keys and a cookie secret are all set.
 * - stub: VOICE_PROVIDER=stub for local dev and tests; in-memory storage and stand-in audio.
 * - off:  anything else, or DEMO_AUDIO_ENABLED=false (the global kill switch).
 */
export type PreviewMode = "live" | "stub" | "off";

export interface ServerConfig {
  mode: PreviewMode;
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  elevenLabsKey?: string;
  elevenLabsModel: string;
  cookieSecret?: string;
  cronSecret?: string;
  /** Server QC floor for a guest take. Client advice is 45s of speech; the server is a little looser. */
  minRecordingMs: number;
  maxRecordingMs: number;
  maxRecordingBytes: number;
  policyVersion: string;
}

export function serverConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const stub = env.VOICE_PROVIDER === "stub";
  const cookieSecret = env.GUEST_COOKIE_SECRET ?? (stub ? "readli-dev-only-secret" : undefined);
  const hasLiveKeys = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.ELEVENLABS_API_KEY && cookieSecret);
  const killed = env.DEMO_AUDIO_ENABLED === "false";

  return {
    mode: killed ? "off" : stub ? "stub" : hasLiveKeys ? "live" : "off",
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    elevenLabsKey: env.ELEVENLABS_API_KEY,
    elevenLabsModel: env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
    cookieSecret,
    cronSecret: env.CRON_SECRET,
    // The recorder won't finish before 1:00; a second of slack covers timer drift between browser clocks.
    minRecordingMs: Number(env.GUEST_MIN_RECORDING_MS ?? 59_000),
    maxRecordingMs: 150_000,
    maxRecordingBytes: 25 * 1024 * 1024,
    policyVersion: env.GUEST_POLICY_VERSION ?? "guest-demo-2026-10",
  };
}

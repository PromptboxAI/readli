import { describe, expect, it } from "vitest";
import { StubVoiceProvider } from "@/lib/voice/stub";
import { ElevenLabsProvider } from "@/lib/voice/elevenlabs";
import { VoiceProviderError } from "@/lib/voice/provider";
import { serverConfig } from "./config";
import { cleanupExpiredGuests } from "./guest-demo";
import { MemoryGuestStore } from "./guest-store";
import { hashGuestToken, sameHash } from "./guest-token";
import { checkUpload } from "./recording-qc";

const limits = { minRecordingMs: 30_000, maxRecordingMs: 150_000, maxRecordingBytes: 25 * 1024 * 1024 };

describe("server config", () => {
  it("is off without keys, stub on request, live with every key, and killable", () => {
    expect(serverConfig({} as NodeJS.ProcessEnv).mode).toBe("off");
    expect(serverConfig({ VOICE_PROVIDER: "stub" } as unknown as NodeJS.ProcessEnv).mode).toBe("stub");
    const live = {
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "k",
      ELEVENLABS_API_KEY: "e",
      GUEST_COOKIE_SECRET: "s",
    } as unknown as NodeJS.ProcessEnv;
    expect(serverConfig(live).mode).toBe("live");
    expect(serverConfig({ ...live, GUEST_COOKIE_SECRET: undefined }).mode).toBe("off");
    expect(serverConfig({ ...live, DEMO_AUDIO_ENABLED: "false" }).mode).toBe("off");
  });
});

describe("server recording QC", () => {
  it("accepts a normal take and names each problem", () => {
    expect(checkUpload({ mimeType: "audio/webm;codecs=opus", bytes: 90 * 24_000, durationMs: 90_000 }, limits)).toEqual([]);
    expect(checkUpload({ mimeType: "video/mp4", bytes: 90 * 24_000, durationMs: 90_000 }, limits)).toContain("unsupported_type");
    expect(checkUpload({ mimeType: "audio/mp4", bytes: 10 * 24_000, durationMs: 10_000 }, limits)).toContain("too_short");
    expect(checkUpload({ mimeType: "audio/mp4", bytes: 1000, durationMs: 90_000 }, limits)).toContain("empty");
    expect(checkUpload({ mimeType: "audio/mp4", bytes: 30 * 1024 * 1024, durationMs: 140_000 }, limits)).toContain("too_large");
  });
});

describe("guest tokens", () => {
  it("hashes with the secret and compares in constant time", () => {
    const a = hashGuestToken("token", "secret");
    expect(a).not.toBe(hashGuestToken("token", "other"));
    expect(sameHash(a, hashGuestToken("token", "secret"))).toBe(true);
    expect(sameHash(a, "short")).toBe(false);
  });
});

describe("memory guest store", () => {
  it("caps previews, refunds failures and finds sessions only by token hash", async () => {
    const store = new MemoryGuestStore();
    const s = await store.createSession({ tokenHash: "h1", policyVersion: "v" });
    expect(await store.findSession("h1")).toMatchObject({ id: s.id, hasVoice: false });
    expect(await store.findSession("nope")).toBeNull();
    expect(await store.useGeneration(s.id)).toBe(true);
    expect(await store.useGeneration(s.id)).toBe(true);
    expect(await store.useGeneration(s.id)).toBe(false);
    await store.refundGeneration(s.id);
    expect(await store.useGeneration(s.id)).toBe(true);
  });

  it("cleanup deletes the provider voice and the session once expired", async () => {
    const store = new MemoryGuestStore();
    const provider = new StubVoiceProvider();
    const s = await store.createSession({ tokenHash: "h2", policyVersion: "v" });
    await store.setVoice(s.id, "voice-1");
    store.guests.get(s.id)!.session.expiresAt = new Date(Date.now() - 1000).toISOString();
    const result = await cleanupExpiredGuests({ config: serverConfig({ VOICE_PROVIDER: "stub" } as unknown as NodeJS.ProcessEnv), store, provider });
    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(provider.deleted).toEqual(["voice-1"]);
    expect(store.guests.size).toBe(0);
  });
});

describe("ElevenLabs provider", () => {
  it("clones with the API key header and multipart files, and hides provider errors from guests", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const ok = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ voice_id: "v123" }), { status: 200 });
    };
    const provider = new ElevenLabsProvider("key", "eleven_multilingual_v2", ok as typeof fetch);
    const { voiceId } = await provider.createInstantVoice({ name: "n", audio: new Blob(["x"]), filename: "take.webm", description: "d" });
    expect(voiceId).toBe("v123");
    expect(calls[0]!.url).toBe("https://api.elevenlabs.io/v1/voices/add");
    expect((calls[0]!.init.headers as Record<string, string>)["xi-api-key"]).toBe("key");
    expect((calls[0]!.init.body as FormData).get("files")).toBeInstanceOf(Blob);

    const failing = new ElevenLabsProvider("key", "m", (async () => new Response("quota", { status: 401 })) as typeof fetch);
    const err = await failing.synthesize({ voiceId: "v", text: "hi" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VoiceProviderError);
    expect((err as VoiceProviderError).userMessage).not.toMatch(/quota|401/);

    const gone = new ElevenLabsProvider("key", "m", (async () => new Response("", { status: 404 })) as typeof fetch);
    await expect(gone.deleteVoice("v")).resolves.toBeUndefined();
  });
});

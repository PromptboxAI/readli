import { cookies } from "next/headers";
import { ElevenLabsProvider } from "@/lib/voice/elevenlabs";
import type { VoiceProvider } from "@/lib/voice/provider";
import { StubVoiceProvider } from "@/lib/voice/stub";
import { serverConfig, type PreviewMode, type ServerConfig } from "./config";
import { guestPreviewsAllowed } from "./demo-settings";
import { createSupabaseGuestStore, MemoryGuestStore, type GuestSession, type GuestStore } from "./guest-store";
import { GUEST_COOKIE, GUEST_TTL_MS, hashGuestToken, newGuestToken } from "./guest-token";

export interface GuestDemoDeps {
  config: ServerConfig;
  store: GuestStore;
  provider: VoiceProvider;
}

const g = globalThis as typeof globalThis & { __readliStub?: { store: MemoryGuestStore; provider: StubVoiceProvider } };

/** Wires the store and provider for the current mode; null when previews are off. */
export function guestDemoDeps(config: ServerConfig = serverConfig()): GuestDemoDeps | null {
  if (config.mode === "stub") {
    g.__readliStub ??= { store: new MemoryGuestStore(), provider: new StubVoiceProvider() };
    return { config, ...g.__readliStub };
  }
  if (config.mode === "live") {
    return {
      config,
      store: createSupabaseGuestStore(config),
      provider: new ElevenLabsProvider(config.elevenLabsKey!, config.elevenLabsModel),
    };
  }
  return null;
}

/** Live mode also honours the database kill switch (feature_flags.demo_audio). */
export async function effectiveMode(deps: GuestDemoDeps | null): Promise<PreviewMode> {
  if (!deps) return "off";
  if (deps.config.mode === "live" && !(await deps.store.demoAudioEnabled())) return "off";
  return deps.config.mode;
}

export async function currentGuest(deps: GuestDemoDeps): Promise<GuestSession | null> {
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!token || !deps.config.cookieSecret) return null;
  return deps.store.findSession(hashGuestToken(token, deps.config.cookieSecret));
}

export async function startGuest(deps: GuestDemoDeps): Promise<GuestSession> {
  const token = newGuestToken();
  const session = await deps.store.createSession({
    tokenHash: hashGuestToken(token, deps.config.cookieSecret!),
    policyVersion: deps.config.policyVersion,
    generationsAllowed: await guestPreviewsAllowed(deps.config),
  });
  (await cookies()).set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_TTL_MS / 1000,
  });
  return session;
}

export interface CleanupResult {
  deleted: number;
  failed: number;
  /** Why each failure happened, so the cleanup workflow log shows it without opening Vercel. */
  errors: string[];
}

/**
 * Deletes expired guests: provider voices first, then stored audio, then the rows. A guest whose
 * provider voice or audio could not be removed is kept so the next run retries it.
 */
export async function cleanupExpiredGuests(deps: GuestDemoDeps, limit = 50): Promise<CleanupResult> {
  const result: CleanupResult = { deleted: 0, failed: 0, errors: [] };
  for (const guest of await deps.store.listExpired(limit)) {
    try {
      for (const voiceId of guest.providerVoiceIds) await deps.provider.deleteVoice(voiceId);
      await deps.store.deleteStorage(guest.storageKeys);
      await deps.store.deleteSession(guest.sessionId);
      result.deleted += 1;
    } catch (err) {
      result.failed += 1;
      result.errors.push(`${guest.sessionId.slice(0, 8)}: ${(err instanceof Error ? err.message : String(err)).slice(0, 300)}`);
      console.error("guest cleanup failed", guest.sessionId, err);
    }
  }
  return result;
}

export function previewsLeft(session: GuestSession): number {
  return Math.max(0, session.generationsAllowed - session.generationsUsed);
}

/** The counts the preview counter shows ("2 of 4 stories explored"). */
export function previewCounts(session: GuestSession) {
  return { previewsLeft: previewsLeft(session), previewsAllowed: session.generationsAllowed };
}

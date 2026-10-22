import { cookies } from "next/headers";
import { ElevenLabsProvider } from "@/lib/voice/elevenlabs";
import type { VoiceProvider } from "@/lib/voice/provider";
import { StubVoiceProvider } from "@/lib/voice/stub";
import { serverConfig, type PreviewMode, type ServerConfig } from "./config";
import { guestPreviewsAllowed } from "./demo-settings";
import { createSupabaseGuestStore, MemoryGuestStore, type GuestSession, type GuestStore } from "./guest-store";
import { DEMO_DELETION_PROMISE_MS, GUEST_COOKIE, GUEST_TTL_MS, hashGuestToken, newGuestToken } from "./guest-token";

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
  /** Expired guests still waiting because the run hit its time budget. */
  backlog: boolean;
  /** Guests still not deleted 48 hours after their demo started: past the public promise. */
  overdue: number;
}

/**
 * Deletes expired guests: provider voices first, then stored audio (original takes and generated
 * previews), then the rows, which cascade to their consent and recording records. A guest whose
 * provider voice or audio could not be removed is kept so the next run retries it, and counts as
 * overdue once it is past the 48-hour promise. Batches repeat until none are left or the time budget
 * runs out. Only guest storage is touched: a take a grown-up saved to their account is a separate copy.
 */
export async function cleanupExpiredGuests(deps: GuestDemoDeps, limit = 50, budgetMs = 45_000, now: () => number = Date.now): Promise<CleanupResult> {
  const result: CleanupResult = { deleted: 0, failed: 0, backlog: false, overdue: 0 };
  const started = now();
  const tried = new Set<string>();
  for (;;) {
    const batch = (await deps.store.listExpired(limit + tried.size, new Date(now()).toISOString())).filter((g) => !tried.has(g.sessionId)).slice(0, limit);
    if (!batch.length) break;
    for (const guest of batch) {
      tried.add(guest.sessionId);
      try {
        if (guest.providerVoiceIds.length) {
          try {
            for (const voiceId of guest.providerVoiceIds) await deps.provider.deleteVoice(voiceId);
          } catch (err) {
            await deps.store.markDeletion(guest.sessionId, "provider_voice", "failed").catch(() => undefined);
            throw err;
          }
          await deps.store.markDeletion(guest.sessionId, "provider_voice", "deleted");
        }
        await deps.store.deleteStorage(guest.storageKeys);
        await deps.store.deleteSession(guest.sessionId);
        result.deleted += 1;
      } catch (err) {
        result.failed += 1;
        console.error("guest cleanup failed", guest.sessionId, err);
      }
    }
    if (now() - started > budgetMs) {
      result.backlog = (await deps.store.listExpired(tried.size + 1, new Date(now()).toISOString())).some((g) => !tried.has(g.sessionId));
      break;
    }
  }
  // A session expires GUEST_TTL_MS after it starts, so this counts demos started over 48 hours ago.
  result.overdue = await deps.store.overdueCount(new Date(now() - (DEMO_DELETION_PROMISE_MS - GUEST_TTL_MS)).toISOString());
  return result;
}

/**
 * A store and provider that clean-up can use only on one demo session and its clone, for the staging
 * deletion check: other demos are never read (their rows aren't even fetched), and any delete naming
 * another session, file or voice throws instead of running.
 */
export function scopeCleanupTo(store: GuestStore, provider: VoiceProvider, sessionId: string, voiceId: string): { store: GuestStore; provider: VoiceProvider } {
  const refuse = (what: string): never => {
    throw new Error(`Refusing to delete ${what}: it wasn't created by this check.`);
  };
  const scopedStore: GuestStore = Object.assign(Object.create(store) as GuestStore, {
    listExpired: (limit: number, asOfIso?: string) => store.listExpired(limit, asOfIso, sessionId),
    overdueCount: (expiredBeforeIso: string) => store.overdueCount(expiredBeforeIso, sessionId),
    markDeletion: async (id: string, kind: "provider_voice", state: "deleted" | "failed") => (id === sessionId ? store.markDeletion(id, kind, state) : refuse(`session ${id}`)),
    deleteStorage: async (keys: string[]) => {
      const other = keys.find((k) => !k.startsWith(`${sessionId}/`));
      return other ? refuse(`file ${other}`) : store.deleteStorage(keys);
    },
    deleteSession: async (id: string) => (id === sessionId ? store.deleteSession(id) : refuse(`session ${id}`)),
  });
  const scopedProvider: VoiceProvider = Object.assign(Object.create(provider) as VoiceProvider, {
    deleteVoice: async (id: string) => (id === voiceId ? provider.deleteVoice(id) : refuse(`voice ${id}`)),
  });
  return { store: scopedStore, provider: scopedProvider };
}

/** What needs an admin's attention after a cleanup run, or null when it went fine. */
export function cleanupAlert(guests: CleanupResult | null, candidates: { failed: number } | null, candidatesError: boolean): string | null {
  const problems: string[] = [];
  if (guests?.failed) problems.push(`${guests.failed} expired demo(s) couldn't be deleted this run; they'll be retried on the next run.`);
  if (guests?.overdue) problems.push(`${guests.overdue} demo(s) are past the 48-hour deletion promise and still not deleted.`);
  if (guests?.backlog) problems.push("The run ran out of time with expired demos still waiting.");
  if (candidates?.failed) problems.push(`${candidates.failed} unkept account recording(s) couldn't be deleted.`);
  if (candidatesError) problems.push("Clean-up of unkept account recordings failed to run.");
  return problems.length ? problems.join("\n") : null;
}

export function previewsLeft(session: GuestSession): number {
  return Math.max(0, session.generationsAllowed - session.generationsUsed);
}

/** The counts the preview counter shows ("2 of 4 stories explored"). */
export function previewCounts(session: GuestSession) {
  return { previewsLeft: previewsLeft(session), previewsAllowed: session.generationsAllowed };
}

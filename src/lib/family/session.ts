import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { authConfigured, currentUser, supabaseServer } from "@/lib/auth/supabase";
import { effectivePlan } from "@/lib/billing/price-settings";
import { accountDb, AccountFamilyStore } from "./account-store";
import { sameHash } from "@/lib/server/guest-token";
import { StubVoiceProvider } from "@/lib/voice/stub";
import { demoFamilyState } from "./demo-family";
import type { Actor } from "./model";
import { MemoryFamilyStore, type FamilyStore } from "./service";
import { planConfig } from "./plan";
import { DEMO_HOUSEHOLD_ID } from "./demo-family";
import { seedDemoNarrations } from "@/lib/narration/demo-seed";
import { AccountNarrationProvider } from "@/lib/narration/account-provider";
import { MemoryNarrationStorage, SupabaseNarrationStorage } from "@/lib/narration/storage";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";
import type { VoiceProvider } from "@/lib/voice/provider";

/**
 * Who is asking. A grown-up signed in with Supabase Auth (email link or Google) uses their own
 * families, saved in Supabase. Without a real sign-in, the family preview uses a signed demo cookie
 * and an in-memory example household. The preview is on in local dev and tests, and off in
 * production unless FAMILY_DEMO=1. Each preview visitor gets their own copy of the household (a
 * sandbox), so nobody's changes leak into anyone else's preview. The service layer only sees an
 * Actor and a store, so both paths share the same permission checks.
 */
export const FAMILY_COOKIE = "readli_family_demo";
/** Which kids profile a signed-in grown-up opened on this device. Tied to that grown-up's account. */
export const KIDS_COOKIE = "readli_kids_profile";
const ACCOUNT_SANDBOX = "account";

export function familyPreviewEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FAMILY_DEMO === "1" || env.VOICE_PROVIDER === "stub" || env.NODE_ENV !== "production";
}

/** Real family accounts need sign-in and the server's Supabase key. */
export function familyAccountsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return authConfigured(env) && Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
}

export function familyEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return familyPreviewEnabled(env) || familyAccountsEnabled(env);
}

function secret(): string {
  return process.env.GUEST_COOKIE_SECRET ?? "readli-dev-only-secret";
}

export interface FamilySession {
  sandbox: string;
  actor: Actor;
  /** Set when a real grown-up is signed in; their families come from Supabase. */
  account?: { id: string; name: string; email: string | null };
}

export function encodeSession({ sandbox, actor }: FamilySession, key = secret()): string {
  const who = actor.kind === "adult" ? `adult:${actor.adultId}` : `child:${actor.childId}`;
  const body = `${sandbox}~${who}`;
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}

export function decodeSession(value: string | undefined, key = secret()): FamilySession | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  if (!sameHash(value.slice(dot + 1), createHmac("sha256", key).update(body).digest("base64url"))) return null;
  const [sandbox, who] = body.split("~");
  const [kind, id] = (who ?? "").split(":");
  if (!sandbox || !id) return null;
  if (kind === "adult") return { sandbox, actor: { kind: "adult", adultId: id } };
  if (kind === "child") return { sandbox, actor: { kind: "child", childId: id } };
  return null;
}

export function encodeKidsProfile(userId: string, childId: string, key = secret()): string {
  const body = `${userId}~${childId}`;
  return `${body}.${createHmac("sha256", `${key}:kids`).update(body).digest("base64url")}`;
}

/** The child id from a kids-profile cookie, only if it was opened by this same grown-up. */
export function decodeKidsProfile(value: string | undefined, userId: string, key = secret()): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  if (!sameHash(value.slice(dot + 1), createHmac("sha256", `${key}:kids`).update(body).digest("base64url"))) return null;
  const [owner, childId] = body.split("~");
  return owner === userId && childId ? childId : null;
}

export const currentSession = cache(async (): Promise<FamilySession | null> => {
  const jar = await cookies();
  if (familyAccountsEnabled()) {
    const user = await currentUser();
    if (user) {
      const childId = decodeKidsProfile(jar.get(KIDS_COOKIE)?.value, user.id);
      return {
        sandbox: ACCOUNT_SANDBOX,
        actor: childId ? { kind: "child", childId } : { kind: "adult", adultId: user.id },
        account: { id: user.id, name: user.name, email: user.email },
      };
    }
  }
  if (!familyPreviewEnabled()) return null;
  return decodeSession(jar.get(FAMILY_COOKIE)?.value);
});

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

/**
 * Switches who is using this device. For a signed-in account it opens or closes a kids profile;
 * signing out (null) also ends the Supabase sign-in, so a child can't get back to the grown-up side.
 */
export async function setSession(session: FamilySession | null): Promise<void> {
  const jar = await cookies();
  if (!session) {
    jar.delete(FAMILY_COOKIE);
    jar.delete(KIDS_COOKIE);
    if (authConfigured()) await (await supabaseServer()).auth.signOut().catch(() => undefined);
    return;
  }
  if (session.account) {
    if (session.actor.kind === "child") jar.set(KIDS_COOKIE, encodeKidsProfile(session.account.id, session.actor.childId), cookieOptions(60 * 60 * 24 * 30));
    else jar.delete(KIDS_COOKIE);
    return;
  }
  jar.set(FAMILY_COOKIE, encodeSession(session), cookieOptions(60 * 60 * 8));
}

export function newSandbox(): string {
  return randomBytes(12).toString("base64url");
}

const MAX_SANDBOXES = 500;
const g = globalThis as typeof globalThis & {
  __readliFamily?: { sandboxes: Map<string, MemoryFamilyStore>; provider: StubVoiceProvider };
};

const accountStores = new WeakMap<FamilySession, FamilyStore>();

/**
 * The store for a session: the signed-in grown-up's saved families, or a preview sandbox created
 * from the demo household (with seeded narrations) on first use.
 */
export async function familyStore(session: FamilySession | string): Promise<FamilyStore | null> {
  if (typeof session !== "string" && session.account) {
    const known = accountStores.get(session);
    if (known) return known;
    const db = accountDb();
    if (!db) return null;
    const audio = new SupabaseNarrationStorage(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    // Admin settings (prices, generation limits) on top of the defaults.
    const store = new AccountFamilyStore(db, session.account, await effectivePlan(db, planConfig()), audio);
    accountStores.set(session, store);
    return store;
  }
  const sandbox = typeof session === "string" ? session : session.sandbox;
  if (!familyPreviewEnabled() || sandbox === ACCOUNT_SANDBOX) return null;
  g.__readliFamily ??= { sandboxes: new Map(), provider: new StubVoiceProvider() };
  const { sandboxes } = g.__readliFamily;
  let store = sandboxes.get(sandbox);
  if (!store) {
    if (sandboxes.size >= MAX_SANDBOXES) sandboxes.delete(sandboxes.keys().next().value!);
    const state = demoFamilyState();
    const audio = new MemoryNarrationStorage();
    const plan = planConfig();
    store = new MemoryFamilyStore(state, plan, audio);
    sandboxes.set(sandbox, store);
    await seedDemoNarrations(state, audio, plan, DEMO_HOUSEHOLD_ID);
  }
  return store;
}

/** Key for signed narration playback URLs. */
export function playbackKey(): string {
  return `${secret()}:playback`;
}

/**
 * Who reads narration aloud: for a signed-in family, the real voice behind each Readli voice (or the
 * stand-in tone when voices run in stub mode); for the preview family, always the stand-in tone.
 */
export function familyProvider(session?: FamilySession): VoiceProvider | null {
  if (session?.account) {
    const deps = accountVoiceDeps(serverConfig());
    return deps ? new AccountNarrationProvider(deps) : null;
  }
  g.__readliFamily ??= { sandboxes: new Map(), provider: new StubVoiceProvider() };
  return g.__readliFamily.provider;
}

export function resetSandbox(sandbox: string): void {
  g.__readliFamily?.sandboxes.delete(sandbox);
}

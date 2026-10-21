import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { authConfigured, currentUser, supabaseServer } from "@/lib/auth/supabase";
import { accountDb, AccountFamilyStore } from "./account-store";
import { sameHash } from "@/lib/server/guest-token";
import { failedTry, GROWNUP_COOKIE, isPinResumed, lockedNow, openStash, PIN_RESUMED_COOKIE, pinResumedValue, sealStash, type GrownUpStash } from "./grownup-stash";
import { activeChild } from "./permissions";
import { StubVoiceProvider } from "@/lib/voice/stub";
import { demoFamilyState } from "./demo-family";
import { KIDS_COOKIE } from "./kids-mode";
import { ACCOUNT_SCOPE, deviceCookieValue, deviceForCookie, isDeviceCookie, MemoryDeviceRegistry, parseDeviceCookie, pinMatches, SupabaseDeviceRegistry, type DeviceRegistry, type KidsDevice } from "./devices";
import type { Actor } from "./model";
import { MemoryFamilyStore, PermissionError, type FamilyStore } from "./service";
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
export { KIDS_COOKIE };
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
  /**
   * Set on a Readli Kids device. The device holds no grown-up sign-in; `account` is then the guardian
   * who set it up, used only to read the family. With no `activeChildId` the kids pick who's listening.
   */
  device?: { id: string; childIds: string[]; householdId: string; label: string; activeChildId: string | null };
  /**
   * Set in temporary Kids Mode: a grown-up opened one child's bookshelf on their own browser. Nothing
   * is registered as a kids device; the pass ends when it expires or a grown-up signs back in.
   */
  temporary?: { childId: string; expiresAt: string };
}

/** How long temporary Kids Mode lasts before a grown-up has to open it again. */
export const TEMPORARY_KIDS_HOURS = 6;
const TEMP_PREFIX = "t1~";

export function isTemporaryKidsCookie(value: string | undefined): boolean {
  return Boolean(value?.startsWith(TEMP_PREFIX));
}

/** A signed pass for temporary Kids Mode: which family (scope), which grown-up opened it, which child, until when. */
export function encodeTemporaryKids(pass: { scope: string; openedBy: string; childId: string; expiresAt: number }, key = secret()): string {
  const body = `${TEMP_PREFIX}${pass.scope}~${pass.openedBy}~${pass.childId}~${pass.expiresAt}`;
  return `${body}.${createHmac("sha256", `${key}:kids-temp`).update(body).digest("base64url")}`;
}

export function decodeTemporaryKids(
  value: string | undefined,
  now = Date.now(),
  key = secret(),
): { scope: string; openedBy: string; childId: string; expiresAt: number } | null {
  if (!isTemporaryKidsCookie(value)) return null;
  const dot = value!.lastIndexOf(".");
  if (dot < 0) return null;
  const body = value!.slice(0, dot);
  if (!sameHash(value!.slice(dot + 1), createHmac("sha256", `${key}:kids-temp`).update(body).digest("base64url"))) return null;
  const [scope, openedBy, childId, expires] = body.slice(TEMP_PREFIX.length).split("~");
  const expiresAt = Number(expires);
  if (!scope || !openedBy || !childId || !Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return { scope, openedBy, childId, expiresAt };
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
  const kids = jar.get(KIDS_COOKIE)?.value;
  // A kids device never falls through to a grown-up sign-in, even if one is somehow still present.
  if (isDeviceCookie(kids)) return deviceSession(kids);
  // Temporary Kids Mode likewise never falls through: an expired or altered pass is simply no session.
  if (isTemporaryKidsCookie(kids)) return temporarySession(kids);
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

/** Where a kids device is kept: Supabase for a signed-in family, memory for the preview. */
export function deviceRegistry(account: boolean): DeviceRegistry | null {
  if (account) {
    const db = familyAccountsEnabled() ? accountDb() : null;
    return db ? new SupabaseDeviceRegistry(db) : null;
  }
  if (!familyPreviewEnabled()) return null;
  g.__readliDevices ??= new MemoryDeviceRegistry();
  return g.__readliDevices;
}

export async function currentDevice(): Promise<{ registry: DeviceRegistry; device: KidsDevice } | null> {
  const value = (await cookies()).get(KIDS_COOKIE)?.value;
  const parsed = parseDeviceCookie(value);
  const registry = parsed ? deviceRegistry(parsed.account) : null;
  const device = registry ? await deviceForCookie(registry, value, secret()) : null;
  return registry && device ? { registry, device } : null;
}

async function deviceSession(value: string | undefined): Promise<FamilySession | null> {
  const found = await currentDevice();
  if (!found || parseDeviceCookie(value)?.id !== found.device.id) return null;
  const { device } = found;
  const actor = { kind: "child" as const, childId: device.activeChildId ?? "" };
  const view = { id: device.id, childIds: device.childIds, householdId: device.householdId, label: device.label, activeChildId: device.activeChildId };
  if (device.scope === ACCOUNT_SCOPE) {
    return { sandbox: ACCOUNT_SANDBOX, actor, account: { id: device.registeredBy, name: "Family member", email: null }, device: view };
  }
  return { sandbox: device.scope, actor, device: view };
}

function temporarySession(value: string | undefined): FamilySession | null {
  const pass = decodeTemporaryKids(value);
  if (!pass) return null;
  const actor = { kind: "child" as const, childId: pass.childId };
  const temporary = { childId: pass.childId, expiresAt: new Date(pass.expiresAt).toISOString() };
  if (pass.scope === ACCOUNT_SCOPE) {
    if (!familyAccountsEnabled()) return null;
    return { sandbox: ACCOUNT_SANDBOX, actor, account: { id: pass.openedBy, name: "Family member", email: null }, temporary };
  }
  if (!familyPreviewEnabled()) return null;
  return { sandbox: pass.scope, actor, temporary };
}

/**
 * Temporary Kids Mode on a grown-up's own browser: this browser shows only one child's bookshelf
 * until a grown-up comes back with the family PIN or signs in. The grown-up's sign-in is set aside
 * here only (never on their other devices): its Supabase cookies are removed without ending the
 * session, and its refresh token is kept encrypted in an httpOnly cookie only the server can open.
 * Nothing is registered as a kids device.
 */
export async function startTemporaryKids(session: FamilySession, childId: string, now = Date.now()): Promise<void> {
  const jar = await cookies();
  const scope = deviceScope(session);
  const openedBy = session.account?.id ?? (session.actor.kind === "adult" ? session.actor.adultId : "");
  const expiresAt = now + TEMPORARY_KIDS_HOURS * 3_600_000;
  let stash: GrownUpStash | null = null;
  if (session.account && authConfigured()) {
    const supabase = await supabaseServer();
    const refresh = (await supabase.auth.getSession().catch(() => null))?.data.session?.refresh_token;
    if (refresh) {
      stash = { user: openedBy, token: refresh, kind: "account", failures: 0, lockedUntil: null, expiresAt };
      for (const c of jar.getAll()) if (/^sb-.+-auth-token/.test(c.name)) jar.delete(c.name);
    } else {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    }
  } else {
    const preview = jar.get(FAMILY_COOKIE)?.value;
    if (preview && decodeSession(preview)?.actor.kind === "adult") stash = { user: openedBy, token: preview, kind: "preview", failures: 0, lockedUntil: null, expiresAt };
  }
  jar.delete(FAMILY_COOKIE);
  jar.delete(PIN_RESUMED_COOKIE);
  if (stash) jar.set(GROWNUP_COOKIE, sealStash(stash, secret()), cookieOptions(TEMPORARY_KIDS_HOURS * 3600));
  else jar.delete(GROWNUP_COOKIE);
  jar.set(KIDS_COOKIE, encodeTemporaryKids({ scope, openedBy, childId, expiresAt }), cookieOptions(TEMPORARY_KIDS_HOURS * 3600));
}

/**
 * Leaves temporary Kids Mode with the family PIN, checked on the server: the grown-up who opened it
 * gets their set-aside sign-in back on this browser. Five wrong tries lock it for 15 minutes. The
 * PIN only brings that sign-in back; sensitive actions still ask for a full sign-in afterwards.
 */
export async function resumeGrownUp(session: FamilySession, pin: unknown, now = Date.now()): Promise<void> {
  if (!session.temporary) throw new PermissionError(409, "not_temporary", "This browser isn't in temporary Kids Mode.");
  const jar = await cookies();
  const stash = openStash(jar.get(GROWNUP_COOKIE)?.value, secret(), now);
  const pass = decodeTemporaryKids(jar.get(KIDS_COOKIE)?.value, now);
  if (!stash || !pass || stash.user !== pass.openedBy) {
    throw new PermissionError(409, "sign_in_required", "A grown-up signs in to leave Kids Mode on this browser.");
  }
  if (lockedNow(stash, now)) throw new PermissionError(429, "pin_locked", "Too many tries. Try again in a few minutes, or sign in instead.");
  const store = await familyStore(session);
  const child = store ? activeChild(await store.read(), session.temporary.childId) : null;
  const stored = child ? await deviceRegistry(Boolean(session.account))?.pinHash(child.householdId) : null;
  if (!stored) throw new PermissionError(409, "no_pin", "Your family hasn't set a grown-up PIN yet. Sign in instead, then set one in Parent controls.");
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin) || !(await pinMatches(pin, stored))) {
    const next = failedTry(stash, now);
    jar.set(GROWNUP_COOKIE, sealStash(next, secret()), cookieOptions(Math.max(1, Math.floor((stash.expiresAt - now) / 1000))));
    if (lockedNow(next, now)) throw new PermissionError(429, "pin_locked", "Too many tries. Try again in a few minutes, or sign in instead.");
    throw new PermissionError(403, "wrong_pin", "That PIN isn't right.", { triesLeft: 5 - next.failures });
  }
  if (stash.kind === "account") {
    const { data, error } = await (await supabaseServer()).auth.refreshSession({ refresh_token: stash.token });
    if (error || data.user?.id !== stash.user) {
      jar.delete(GROWNUP_COOKIE);
      throw new PermissionError(409, "sign_in_required", "Your sign-in has ended. Sign in to leave Kids Mode.");
    }
    jar.set(PIN_RESUMED_COOKIE, pinResumedValue(stash.user, secret()), cookieOptions(60 * 60 * 24 * 30));
  } else {
    jar.set(FAMILY_COOKIE, stash.token, cookieOptions(60 * 60 * 8));
  }
  jar.delete(GROWNUP_COOKIE);
  jar.delete(KIDS_COOKIE);
}

/**
 * Sensitive account actions (billing, deleting a voice or the account, changing who a voice is shared
 * with) need a grown-up who signed in fully on this browser: a sign-in brought back with the family
 * PIN isn't enough until they sign in again.
 */
export async function requireFullSignIn(session: FamilySession | null): Promise<void> {
  if (!session?.account || session.temporary || session.device) return;
  if (isPinResumed((await cookies()).get(PIN_RESUMED_COOKIE)?.value, session.account.id, secret())) {
    throw new PermissionError(403, "reauth_required", "For your security, sign in again to do this.");
  }
}

/** The scope a new kids device for this session belongs to. */
export function deviceScope(session: FamilySession): string {
  return session.account ? ACCOUNT_SCOPE : session.sandbox;
}

/**
 * Turns this device into a Readli Kids device: it keeps only the device key. A signed-in grown-up is
 * signed out here, so their sign-in is never left on a device a child uses.
 */
export async function startKidsDevice(device: KidsDevice, token: string): Promise<void> {
  const jar = await cookies();
  // Local scope: only this browser signs out; the grown-up stays signed in on their other devices.
  if (device.scope === ACCOUNT_SCOPE && authConfigured()) await (await supabaseServer()).auth.signOut({ scope: "local" }).catch(() => undefined);
  jar.delete(FAMILY_COOKIE);
  jar.set(KIDS_COOKIE, deviceCookieValue(device, token), cookieOptions(60 * 60 * 24 * 400));
}

export async function endKidsDevice(): Promise<void> {
  const jar = await cookies();
  jar.delete(KIDS_COOKIE);
  jar.delete(FAMILY_COOKIE);
}

/** The secret for device keys. */
export function deviceSecret(): string {
  return secret();
}

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
    if (authConfigured()) await (await supabaseServer()).auth.signOut({ scope: "local" }).catch(() => undefined);
    return;
  }
  if (session.account) {
    if (session.actor.kind === "child") jar.set(KIDS_COOKIE, encodeKidsProfile(session.account.id, session.actor.childId), cookieOptions(60 * 60 * 24 * 30));
    else jar.delete(KIDS_COOKIE);
    return;
  }
  if (session.actor.kind === "adult") jar.delete(KIDS_COOKIE);
  jar.set(FAMILY_COOKIE, encodeSession(session), cookieOptions(60 * 60 * 8));
}

export function newSandbox(): string {
  return randomBytes(12).toString("base64url");
}

const MAX_SANDBOXES = 500;
const g = globalThis as typeof globalThis & {
  __readliFamily?: { sandboxes: Map<string, MemoryFamilyStore>; provider: StubVoiceProvider };
  __readliDevices?: MemoryDeviceRegistry;
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
    const store = new AccountFamilyStore(db, session.account, planConfig(), audio);
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

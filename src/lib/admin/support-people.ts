import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { isPaused } from "@/lib/auth/supabase";
import { deviceStatus, NO_PIN_LOCK, SupabaseDeviceRegistry, type DeviceStatus } from "@/lib/family/devices";
import type { FamilyState } from "@/lib/family/model";
import { activeShare, activeSlot, childVoiceAccess } from "@/lib/family/permissions";
import type { PlanConfig } from "@/lib/family/plan";
import { bookText } from "@/lib/narration/text";
import { SITE_URL } from "@/lib/seo/site";
import type { AdminUser } from "./access";
import { isAdmin } from "./emails";
import { AdminActionError } from "./tester-plans";

/**
 * Support's view of the people side of a family and of one sign-in (Kevin, 2026-11-08): kids devices
 * and the Kids Mode PIN, storyteller voices and their consent, kids' reading places, the family's
 * permission history, and a grown-up's sign-in. Fixes here never touch audio, voices or consent.
 */

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);

async function rows(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<Row[]> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as Row[];
}

const nameIn = (state: FamilyState, householdId: string, adultId: string | null | undefined) => {
  if (!adultId) return "someone";
  const m = state.members.find((x) => x.householdId === householdId && x.adultId === adultId && x.removedAt === null);
  return m?.nickname?.trim() || state.adults.find((a) => a.id === adultId)?.displayName || "someone no longer in the family";
};

// ---------------------------------------------------------------------------
// Kids devices and the Kids Mode PIN
// ---------------------------------------------------------------------------

export interface SupportDevice {
  id: string;
  label: string;
  status: DeviceStatus;
  registeredBy: string;
  kids: string[];
  listening: string | null;
  createdAt: string;
  lastSeenAt: string;
  pinLockedUntil: string | null;
  failedPinAttempts: number;
}

export interface SupportPin {
  set: boolean;
  updatedAt: string | null;
  failures: number;
  lockedUntil: string | null;
}

export async function supportDevices(db: SupabaseClient, state: FamilyState, householdId: string, now = new Date()): Promise<{ devices: SupportDevice[]; pin: SupportPin }> {
  const registry = new SupabaseDeviceRegistry(db);
  const kid = (id: string | null) => state.children.find((c) => c.id === id)?.nickname ?? null;
  const [list, pinRows, lock] = await Promise.all([
    registry.list(householdId),
    rows(db.from("household_kids_pins").select("updated_at").eq("household_id", householdId).limit(1), "read PIN"),
    registry.pinLock(householdId),
  ]);
  const devices = list
    .map((d) => ({
      id: d.id,
      label: d.label,
      status: deviceStatus(d, now),
      registeredBy: nameIn(state, householdId, d.registeredBy),
      kids: d.childIds.map(kid).filter((n): n is string => Boolean(n)),
      listening: kid(d.activeChildId),
      createdAt: d.createdAt,
      lastSeenAt: d.lastSeenAt,
      pinLockedUntil: d.pinLockedUntil && Date.parse(d.pinLockedUntil) > now.getTime() ? d.pinLockedUntil : null,
      failedPinAttempts: d.failedPinAttempts,
    }))
    .sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active") || b.lastSeenAt.localeCompare(a.lastSeenAt));
  const lockedUntil = lock.lockedUntil && Date.parse(lock.lockedUntil) > now.getTime() ? lock.lockedUntil : null;
  return { devices, pin: { set: pinRows.length > 0, updatedAt: str(pinRows[0]?.updated_at), failures: lock.failures, lockedUntil } };
}

/** Clears wrong-PIN lockouts on every device of the family and on temporary Kids Mode. The PIN itself stays. */
export async function unlockKidsPin(db: SupabaseClient, householdId: string): Promise<number> {
  const registry = new SupabaseDeviceRegistry(db);
  const locked = (await registry.list(householdId)).filter((d) => d.failedPinAttempts > 0 || d.pinLockedUntil);
  for (const d of locked) await registry.update(d.id, { failedPinAttempts: 0, pinLockedUntil: null });
  await registry.setPinLock(householdId, NO_PIN_LOCK);
  return locked.length;
}

/**
 * Forgets the family's Kids Mode PIN, for a parent who can't remember it. Until a parent sets a new one
 * in settings, leaving Readli Kids asks a grown-up to sign in instead.
 */
export async function clearKidsPin(db: SupabaseClient, householdId: string): Promise<void> {
  const { error } = await db.from("household_kids_pins").delete().eq("household_id", householdId);
  if (error) throw new Error(`clear PIN: ${error.message}`);
}

/** Signs one kids device out, as a parent's "Remove device" does. Kids on it go back to the sign-in screen. */
export async function signOutDevice(db: SupabaseClient, admin: AdminUser, householdId: string, deviceId: string, now = new Date()): Promise<string> {
  const registry = new SupabaseDeviceRegistry(db);
  const device = await registry.get(deviceId);
  if (!device || device.householdId !== householdId) throw new AdminActionError("That device isn't in this family.");
  if (device.revokedAt) throw new AdminActionError("That device is already signed out.");
  await registry.update(deviceId, { revokedAt: now.toISOString(), revokedBy: admin.id, activeChildId: null });
  return device.label;
}

// ---------------------------------------------------------------------------
// Storyteller voices and consent
// ---------------------------------------------------------------------------

export interface SupportVoice {
  id: string;
  owner: string;
  ownerId: string;
  status: "processing" | "ready" | "deleted";
  version: number;
  modelId: string | null;
  createdAt: string;
  /** The owner's sharing with this family: since when, or when they stopped. */
  sharedSince: string | null;
  unsharedAt: string | null;
  inSlot: boolean;
  approvedFor: string[];
  consent: { policyVersion: string; capturedAt: string; revokedAt: string | null; purposes: string[] } | null;
}

/** Every voice belonging to someone in the family or ever shared with it, with the owner's consent on file. */
export async function supportVoices(db: SupabaseClient, state: FamilyState, plan: PlanConfig, householdId: string): Promise<SupportVoice[]> {
  const memberIds = new Set(state.members.filter((m) => m.householdId === householdId).map((m) => m.adultId));
  const sharedIds = new Set(state.shares.filter((s) => s.householdId === householdId).map((s) => s.voiceId));
  const voices = state.voices.filter((v) => memberIds.has(v.ownerId) || sharedIds.has(v.id));
  const ids = voices.map((v) => v.id);
  const consents = ids.length ? await rows(db.from("voice_consents").select("voice_id, policy_version, purposes, captured_at, revoked_at").in("voice_id", ids), "read consents") : [];
  const kids = state.children.filter((c) => c.householdId === householdId && c.deletedAt === null);
  return voices
    .map((v) => {
      const share = activeShare(state, v.id, householdId);
      const last = state.shares.filter((s) => s.voiceId === v.id && s.householdId === householdId).sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))[0];
      const consent = consents.filter((c) => c.voice_id === v.id).sort((a, b) => String(b.captured_at).localeCompare(String(a.captured_at)))[0];
      return {
        id: v.id,
        owner: nameIn(state, householdId, v.ownerId),
        ownerId: v.ownerId,
        status: v.deletedAt ? ("deleted" as const) : v.status,
        version: v.version,
        modelId: v.modelId ?? null,
        createdAt: v.createdAt,
        sharedSince: share?.grantedAt ?? null,
        unsharedAt: share ? null : (last?.revokedAt ?? null),
        inSlot: activeSlot(state, v.id, householdId, plan) !== null,
        approvedFor: kids.filter((c) => childVoiceAccess(state, c.id, v.id, plan).allowed).map((c) => c.nickname),
        consent: consent
          ? { policyVersion: String(consent.policy_version), capturedAt: String(consent.captured_at), revokedAt: str(consent.revoked_at), purposes: (consent.purposes as string[]) ?? [] }
          : null,
      };
    })
    .sort((a, b) => a.owner.localeCompare(b.owner));
}

// ---------------------------------------------------------------------------
// Reading places and the family's history
// ---------------------------------------------------------------------------

export interface SupportPlace {
  kid: string;
  book: string;
  sentence: number;
  of: number | null;
  narrator: string | null;
  at: string;
}

/** Where each kid is in each book, most recent first. */
export function supportPlaces(state: FamilyState, householdId: string): SupportPlace[] {
  const kids = new Map(state.children.filter((c) => c.householdId === householdId).map((c) => [c.id, c.nickname]));
  return state.progress
    .filter((p) => kids.has(p.childId))
    .map((p) => {
      const text = bookText(p.bookSlug);
      const voice = state.voices.find((v) => v.id === p.voiceId);
      return {
        kid: kids.get(p.childId)!,
        book: text?.title ?? p.bookSlug,
        sentence: p.sentence + 1,
        of: text?.sentences.length ?? null,
        narrator: voice ? nameIn(state, householdId, voice.ownerId) : null,
        at: p.listenedAt ?? p.updatedAt,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

const EVENT: Record<string, string> = {
  voice_shared: "shared their voice",
  voice_unshared: "stopped sharing their voice",
  child_voice_approved: "approved a storyteller for a kid",
  child_voice_removed: "removed a storyteller from a kid",
  narration_requested: "started preparing a book",
  narration_canceled: "stopped a preparation",
  narrator_activated: "put a storyteller in a narrator slot",
  narrator_released: "took a storyteller out of a narrator slot",
  narrator_slot_added: "added a narrator slot",
  child_profile_created: "added a kid",
  child_profile_removed: "removed a kid",
  entitlement_granted: "got a Family plan",
  credits_purchased: "bought credits",
};

export interface SupportEvent {
  at: string;
  who: string;
  what: string;
  /** Admin actions are support's own; the rest are the family's. */
  bySupport: boolean;
}

/** The family's recent permission changes and support's actions on it, newest first. */
export async function supportHistory(db: SupabaseClient, state: FamilyState, householdId: string, limit = 60): Promise<SupportEvent[]> {
  const [family, admin] = await Promise.all([
    rows(db.from("permission_audit_log").select("at, actor, action, voice_id, child_id, detail").eq("household_id", householdId).order("at", { ascending: false }).limit(limit), "read family history"),
    rows(db.from("admin_actions").select("created_at, admin_email, action, detail").eq("household_id", householdId).order("created_at", { ascending: false }).limit(limit), "read admin history"),
  ]);
  const voiceOwner = (id: unknown) => {
    const v = state.voices.find((x) => x.id === id);
    return v ? nameIn(state, householdId, v.ownerId) : null;
  };
  const kid = (id: unknown) => state.children.find((c) => c.id === id)?.nickname ?? null;
  const events: SupportEvent[] = [
    ...family.map((e) => {
      const extra = [voiceOwner(e.voice_id) && `voice: ${voiceOwner(e.voice_id)}`, kid(e.child_id) && `kid: ${kid(e.child_id)}`].filter(Boolean).join(", ");
      return {
        at: String(e.at),
        who: nameIn(state, householdId, String(e.actor)),
        what: `${EVENT[String(e.action)] ?? String(e.action).replaceAll("_", " ")}${extra ? ` (${extra})` : ""}`,
        bySupport: false,
      };
    }),
    ...admin.map((e) => ({ at: String(e.created_at), who: String(e.admin_email), what: String(e.action).replaceAll("_", " "), bySupport: true })),
  ];
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

// ---------------------------------------------------------------------------
// One sign-in
// ---------------------------------------------------------------------------

export interface SupportAccount {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmedAt: string | null;
  paused: boolean;
  isAdmin: boolean;
  providers: string[];
  families: { id: string; name: string; role: string; joinedAt: string; removedAt: string | null }[];
  voices: { id: string; status: string; createdAt: string; deletedAt: string | null; sharedWith: string[] }[];
}

const nameOf = (u: User): string | null => {
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  const n = m.full_name ?? m.name ?? m.display_name;
  return typeof n === "string" && n.trim() ? n.trim() : null;
};

/** One grown-up's sign-in, families (current and past) and voices. Null when the sign-in doesn't exist. */
export async function supportAccount(db: SupabaseClient, userId: string, env: NodeJS.ProcessEnv = process.env): Promise<SupportAccount | null> {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  const u = data.user;
  const [members, voices] = await Promise.all([
    rows(db.from("household_members").select("household_id, role, joined_at, removed_at").eq("user_id", userId), "read families"),
    rows(db.from("voice_profiles").select("id, status, created_at, deleted_at").eq("owner_id", userId), "read voices"),
  ]);
  const voiceIds = voices.map((v) => v.id as string);
  const shares = voiceIds.length
    ? await rows(db.from("voice_household_shares").select("voice_id, household_id").in("voice_id", voiceIds).is("revoked_at", null), "read sharing")
    : [];
  const homeIds = [...new Set([...members.map((m) => m.household_id as string), ...shares.map((s) => s.household_id as string)])];
  const homes = homeIds.length ? await rows(db.from("households").select("id, name").in("id", homeIds), "read family names") : [];
  const home = (id: unknown) => (homes.find((h) => h.id === id)?.name as string | undefined) ?? "A removed family";
  return {
    id: u.id,
    email: u.email ?? null,
    name: nameOf(u),
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    confirmedAt: u.email_confirmed_at ?? null,
    paused: isPaused(u),
    isAdmin: isAdmin(u, env),
    providers: ((u.app_metadata?.providers as string[] | undefined) ?? [u.app_metadata?.provider as string | undefined]).filter((p): p is string => Boolean(p)),
    families: members
      .map((m) => ({ id: m.household_id as string, name: home(m.household_id), role: String(m.role), joinedAt: String(m.joined_at), removedAt: str(m.removed_at) }))
      .sort((a, b) => Number(Boolean(a.removedAt)) - Number(Boolean(b.removedAt)) || a.joinedAt.localeCompare(b.joinedAt)),
    voices: voices.map((v) => ({
      id: v.id as string,
      status: String(v.status),
      createdAt: String(v.created_at),
      deletedAt: str(v.deleted_at),
      sharedWith: shares.filter((s) => s.voice_id === v.id).map((s) => home(s.household_id)),
    })),
  };
}

/**
 * Has Supabase email the grown-up a fresh sign-in link and code, as the sign-in page does. Support
 * never sees the link. Never creates an account.
 */
export async function sendSignInEmail(db: SupabaseClient, userId: string, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user?.email) throw new AdminActionError("That account has no email to send to.");
  if (isPaused(data.user)) throw new AdminActionError("That account is paused. Unpause it on Accounts first.");
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new AdminActionError("Sign-in isn't configured here.");
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } }).auth;
  const sent = await auth.signInWithOtp({ email: data.user.email, options: { shouldCreateUser: false, emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent("/family")}` } });
  if (sent.error) {
    throw new AdminActionError(sent.error.status === 429 ? "Supabase is limiting sign-in emails to that address. Try again in a minute." : `The email didn't send: ${sent.error.message}`);
  }
  return data.user.email;
}

/** Marks a sign-in's email confirmed, for someone whose confirmation email never arrived. */
export async function confirmEmail(db: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) throw new AdminActionError("That account no longer exists.");
  if (data.user.email_confirmed_at) throw new AdminActionError("That email is already confirmed.");
  const done = await db.auth.admin.updateUserById(userId, { email_confirm: true });
  if (done.error) throw new Error(`confirm email: ${done.error.message}`);
  return data.user.email ?? "the account";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Moves a sign-in to a new email address, for a grown-up who lost the old one. The admin types the new
 * address twice. Admin accounts can't be changed here, and an address another account uses is refused.
 */
export async function changeEmail(db: SupabaseClient, admin: AdminUser, userId: string, email: string, again: string, env: NodeJS.ProcessEnv = process.env): Promise<{ from: string | null; to: string }> {
  const to = email.trim().toLowerCase();
  if (!EMAIL.test(to)) throw new AdminActionError("Enter the new email address.");
  if (to !== again.trim().toLowerCase()) throw new AdminActionError("The two email addresses don't match.");
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) throw new AdminActionError("That account no longer exists.");
  if (data.user.id === admin.id || isAdmin(data.user, env)) throw new AdminActionError("Admin accounts can't be changed here.");
  if ((data.user.email ?? "").toLowerCase() === to) throw new AdminActionError("That's already the account's email.");
  const done = await db.auth.admin.updateUserById(userId, { email: to, email_confirm: true });
  if (done.error) {
    throw new AdminActionError(/already|registered|exists/i.test(done.error.message) ? "Another account already uses that email." : `The email wasn't changed: ${done.error.message}`);
  }
  return { from: data.user.email ?? null, to };
}

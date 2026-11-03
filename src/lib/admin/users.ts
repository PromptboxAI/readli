import type { SupabaseClient, User } from "@supabase/supabase-js";
import { deleteAccount, type DeletionBlocker } from "@/lib/account/privacy";
import { isPaused } from "@/lib/auth/supabase";
import type { VoiceProvider } from "@/lib/voice/provider";
import type { ProviderRefCipher } from "@/lib/server/provider-ref";
import type { AdminUser } from "./access";
import { isAdmin } from "./emails";
import { AdminActionError } from "./tester-plans";

export interface AdminAccount {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  isAdmin: boolean;
  paused: boolean;
  families: string[];
}

const PAGE = 1000;
const MAX_PAGES = 20;

async function allUsers(db: SupabaseClient): Promise<User[]> {
  const out: User[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw new Error(`list users: ${error.message}`);
    out.push(...data.users);
    if (data.users.length < PAGE) break;
  }
  return out;
}

const nameOf = (u: User): string | null => {
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  const n = m.full_name ?? m.name ?? m.display_name;
  return typeof n === "string" && n.trim() ? n.trim() : null;
};

/** Every sign-in account, newest first, with the families each one belongs to. */
export async function listAccounts(db: SupabaseClient, env: NodeJS.ProcessEnv = process.env): Promise<AdminAccount[]> {
  const users = await allUsers(db);
  const ids = users.map((u) => u.id);
  const families = new Map<string, string[]>();
  if (ids.length) {
    const { data: members, error } = await db.from("household_members").select("user_id, household_id").is("removed_at", null);
    if (error) throw new Error(`read members: ${error.message}`);
    const homeIds = [...new Set((members ?? []).map((m) => m.household_id as string))];
    const names = new Map<string, string>();
    if (homeIds.length) {
      const { data: homes, error: homesError } = await db.from("households").select("id, name").in("id", homeIds);
      if (homesError) throw new Error(`read families: ${homesError.message}`);
      for (const h of homes ?? []) names.set(h.id as string, h.name as string);
    }
    for (const m of members ?? []) {
      const name = names.get(m.household_id as string);
      if (name) families.set(m.user_id as string, [...(families.get(m.user_id as string) ?? []), name]);
    }
  }
  return users
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      name: nameOf(u),
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      confirmed: Boolean(u.email_confirmed_at),
      isAdmin: isAdmin(u, env),
      paused: isPaused(u),
      families: families.get(u.id) ?? [],
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Narrows the list by email, name or family name. */
export function filterAccounts(accounts: AdminAccount[], query: string): AdminAccount[] {
  const q = query.trim().toLowerCase();
  if (!q) return accounts;
  return accounts.filter(
    (a) => (a.email ?? "").toLowerCase().includes(q) || (a.name ?? "").toLowerCase().includes(q) || a.families.some((f) => f.toLowerCase().includes(q)),
  );
}

export function describeBlocker(b: DeletionBlocker): string {
  if (b.kind === "only_guardian") return `they're the only grown-up in charge of kids in ${b.householdName}`;
  return `they're paying for a gift subscription for ${b.recipientName} that still renews`;
}

/**
 * Deletes an account the same way the grown-up's own "Delete my account" does: their voice and its
 * audio, families only they belong to, their photos and recordings, then the sign-in. The admin must
 * type the account's email to confirm. Admin accounts, including your own, can't be deleted here.
 */
export async function adminDeleteAccount(
  deps: { db: SupabaseClient; provider: VoiceProvider | null; refs: ProviderRefCipher | null },
  admin: AdminUser,
  userId: string,
  typedEmail: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const user = await target(deps.db, admin, userId, env);
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email || typedEmail.trim().toLowerCase() !== email) throw new AdminActionError("Type the account's email exactly to confirm.");
  const result = await deleteAccount(deps, userId);
  if (!result.deleted) {
    throw new AdminActionError(`${user.email} wasn't deleted because ${result.blockers.map(describeBlocker).join(", and ")}.`);
  }
  console.info(`[admin] ${admin.email} deleted account ${user.id} (${user.email})`);
  return user.email ?? "the account";
}

/** Roughly a hundred years: Supabase has no "forever", so a pause lasts until an admin lifts it. */
export const PAUSE_DURATION = "876000h";

async function target(db: SupabaseClient, admin: AdminUser, userId: string, env: NodeJS.ProcessEnv): Promise<User> {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) throw new AdminActionError("That account no longer exists.");
  if (data.user.id === admin.id) throw new AdminActionError("You can't change your own admin account here.");
  if (isAdmin(data.user, env)) throw new AdminActionError("Admin accounts can't be changed here.");
  return data.user;
}

/**
 * Pauses an account: it can't sign in, and any device already signed in is treated as signed out.
 * Nothing is deleted, and unpausing puts everything back as it was.
 */
export async function setAccountPaused(db: SupabaseClient, admin: AdminUser, userId: string, paused: boolean, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const user = await target(db, admin, userId, env);
  const { error } = await db.auth.admin.updateUserById(user.id, { ban_duration: paused ? PAUSE_DURATION : "none" });
  if (error) throw new Error(`${paused ? "pause" : "unpause"} account: ${error.message}`);
  console.info(`[admin] ${admin.email} ${paused ? "paused" : "unpaused"} account ${user.id} (${user.email})`);
  return user.email ?? "the account";
}

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { deleteAccount, type DeletionBlocker } from "@/lib/account/privacy";
import { isPaused } from "@/lib/auth/supabase";
import type { VoiceProvider } from "@/lib/voice/provider";
import type { ProviderRefCipher } from "@/lib/server/provider-ref";
import type { AdminUser } from "./access";
import { isAdmin } from "./emails";
import { AdminActionError } from "./tester-plans";
import { livePlan, type AdminPlan } from "./overview";

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
  /** Each family with the plan it has right now (paid, complimentary, tester or trial), if any. */
  homes: { name: string; plan: AdminPlan | null }[];
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
  const homes = new Map<string, { name: string; plan: AdminPlan | null }[]>();
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
    const { data: plans, error: plansError } = homeIds.length
      ? await db.from("household_entitlements").select("id, household_id, source, status, starts_at, ends_at").eq("status", "active").in("household_id", homeIds)
      : { data: [], error: null };
    if (plansError) throw new Error(`read plans: ${plansError.message}`);
    const now = new Date();
    for (const m of members ?? []) {
      const id = m.household_id as string;
      const name = names.get(id);
      if (!name) continue;
      const user = m.user_id as string;
      families.set(user, [...(families.get(user) ?? []), name]);
      homes.set(user, [...(homes.get(user) ?? []), { name, plan: livePlan((plans ?? []) as Record<string, unknown>[], id, now) }]);
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
      homes: homes.get(u.id) ?? [],
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

/** The account-list filter: everyone, or one slice of them. */
export const ACCOUNT_FILTERS = [
  { value: "paid", label: "Paid plan" },
  { value: "complimentary", label: "Complimentary or gift" },
  { value: "tester", label: "Tester or trial" },
  { value: "no_plan", label: "Family, no plan" },
  { value: "no_family", label: "No family" },
  { value: "paused", label: "Paused" },
  { value: "unconfirmed", label: "Email not confirmed" },
] as const;
export type AccountFilter = (typeof ACCOUNT_FILTERS)[number]["value"];

const sources = (a: AdminAccount) => a.homes.map((h) => h.plan?.source ?? null);

export function matchesFilter(a: AdminAccount, filter: AccountFilter | null): boolean {
  switch (filter) {
    case null:
      return true;
    case "paid":
      return sources(a).includes("subscription");
    case "complimentary":
      return sources(a).some((s) => s === "donated" || s === "gift");
    case "tester":
      return sources(a).some((s) => s === "tester" || s === "trial");
    case "no_plan":
      return a.homes.length > 0 && sources(a).every((s) => s === null);
    case "no_family":
      return a.homes.length === 0;
    case "paused":
      return a.paused;
    case "unconfirmed":
      return !a.confirmed;
  }
}

/** Columns the account table sorts by. Dates sort newest first, text A to Z. */
export const ACCOUNT_SORTS = ["joined", "last_sign_in", "email", "family"] as const;
export type AccountSort = (typeof ACCOUNT_SORTS)[number];

export function sortAccounts(accounts: AdminAccount[], sort: AccountSort): AdminAccount[] {
  const text = (v: string | null | undefined) => (v ?? "").toLowerCase();
  const by: Record<AccountSort, (a: AdminAccount, b: AdminAccount) => number> = {
    joined: (a, b) => b.createdAt.localeCompare(a.createdAt),
    last_sign_in: (a, b) => (b.lastSignInAt ?? "").localeCompare(a.lastSignInAt ?? ""),
    email: (a, b) => text(a.email).localeCompare(text(b.email)),
    family: (a, b) => (a.families.length ? 0 : 1) - (b.families.length ? 0 : 1) || text(a.families[0]).localeCompare(text(b.families[0])),
  };
  return [...accounts].sort((a, b) => by[sort](a, b) || b.createdAt.localeCompare(a.createdAt));
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
  console.info(`[admin] ${admin.id} deleted account ${user.id}`);
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
  console.info(`[admin] ${admin.id} ${paused ? "paused" : "unpaused"} account ${user.id}`);
  return user.email ?? "the account";
}

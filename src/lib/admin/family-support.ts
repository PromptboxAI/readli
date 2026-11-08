import type { SupabaseClient } from "@supabase/supabase-js";
import { effectivePlan } from "@/lib/billing/price-settings";
import { AccountFamilyStore } from "@/lib/family/account-store";
import type { FamilyState } from "@/lib/family/model";
import { activeEntitlement } from "@/lib/family/permissions";
import type { PlanConfig } from "@/lib/family/plan";
import { SupabaseNarrationStorage } from "@/lib/narration/storage";
import type { AdminUser } from "./access";

/**
 * Support's way into one family (Kevin, 2026-11-08): the family's own saved state, read with the
 * service key through one of its grown-ups, so admin sees exactly what the family's pages see and
 * support fixes go through the same rules the family's own actions do.
 */

export interface SupportFamily {
  store: AccountFamilyStore;
  plan: PlanConfig;
  /** The grown-up the family is read through: its owner when still in it, else its longest-standing parent. */
  readThrough: string;
}

type Row = Record<string, unknown>;

/** The family's store, or null when the family doesn't exist or has no grown-up left in it. */
export async function supportFamily(db: SupabaseClient, householdId: string): Promise<SupportFamily | null> {
  const { data: home, error } = await db.from("households").select("id, created_by").eq("id", householdId).maybeSingle();
  if (error) throw new Error(`read family: ${error.message}`);
  if (!home) return null;
  const { data: members, error: membersError } = await db
    .from("household_members")
    .select("user_id, role, joined_at")
    .eq("household_id", householdId)
    .is("removed_at", null)
    .order("joined_at");
  if (membersError) throw new Error(`read members: ${membersError.message}`);
  const rows = (members ?? []) as Row[];
  const pick =
    rows.find((m) => m.user_id === home.created_by && m.role === "guardian") ?? rows.find((m) => m.role === "guardian") ?? rows[0];
  if (!pick) return null;
  const userId = pick.user_id as string;
  const { data: profile } = await db.from("adult_profiles").select("display_name").eq("user_id", userId).maybeSingle();
  const plan = await effectivePlan(db);
  const audio = new SupabaseNarrationStorage(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const store = new AccountFamilyStore(db, { id: userId, name: (profile?.display_name as string | undefined) || "Grown-up" }, plan, audio);
  return { store, plan, readThrough: userId };
}

export interface SupportPerson {
  id: string;
  name: string;
  email: string | null;
  role: "guardian" | "member";
  owner: boolean;
  joinedAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  /** What this family calls them, such as "Grandma". */
  calledHere: string | null;
}

/** The family's grown-ups, with each sign-in's email. A sign-in that can't be read shows without one. */
export async function supportPeople(db: SupabaseClient, state: FamilyState, householdId: string): Promise<SupportPerson[]> {
  const home = state.households.find((h) => h.id === householdId);
  const members = state.members.filter((m) => m.householdId === householdId && m.removedAt === null);
  return Promise.all(
    members.map(async (m) => {
      const { data } = await db.auth.admin.getUserById(m.adultId);
      const u = data?.user ?? null;
      return {
        id: m.adultId,
        name: state.adults.find((a) => a.id === m.adultId)?.displayName ?? "Family member",
        email: u?.email ?? null,
        role: m.role,
        owner: home?.ownerId === m.adultId,
        joinedAt: m.joinedAt,
        lastSignInAt: u?.last_sign_in_at ?? null,
        confirmed: Boolean(u?.email_confirmed_at),
        calledHere: m.nickname?.trim() || m.relationship?.trim() || null,
      };
    }),
  ).then((people) => people.sort((a, b) => Number(b.owner) - Number(a.owner) || a.joinedAt.localeCompare(b.joinedAt)));
}

export function supportPlan(state: FamilyState, householdId: string, at = new Date().toISOString()) {
  return activeEntitlement(state, householdId, at);
}

/** Support actions recorded in the admin log. */
export type SupportAction =
  | "narration_carried_forward"
  | "narration_prepared_free"
  | "narration_stopped"
  | "narration_resumed"
  | "narration_refunded"
  | "kids_pin_unlocked"
  | "kids_pin_cleared"
  | "kids_device_signed_out"
  | "sign_in_email_sent"
  | "email_confirmed"
  | "email_changed"
  | "credits_taken_back";

/**
 * Records a support action. Logging never blocks the fix itself: until migration 20261108000200 widens
 * the log's list of actions, a failed insert is only warned about.
 */
export async function logSupportAction(db: SupabaseClient, admin: AdminUser, action: SupportAction, householdId: string | null, detail: Record<string, unknown>) {
  const { error } = await db.from("admin_actions").insert({ admin_id: admin.id, admin_email: admin.email, action, household_id: householdId, detail });
  if (error) console.warn(`[admin] log ${action}: ${error.message}`);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminUser } from "./access";
import { livePlan } from "./overview";

/** Lengths an admin can pick. null means the plan runs until an admin ends it. */
export const TESTER_PLAN_DAYS = [30, 90, null] as const;
export type TesterPlanDays = (typeof TESTER_PLAN_DAYS)[number];

export function parseTesterDays(value: unknown): TesterPlanDays | undefined {
  if (value === "none") return null;
  const n = Number(value);
  return TESTER_PLAN_DAYS.find((d) => d === n);
}

export function testerPlanEnd(days: TesterPlanDays, at = new Date()): string | null {
  return days === null ? null : new Date(at.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export class AdminActionError extends Error {}

async function log(db: SupabaseClient, admin: AdminUser, action: "tester_plan_granted" | "tester_plan_ended", householdId: string, detail: Record<string, unknown>) {
  const { error } = await db.from("admin_actions").insert({ admin_id: admin.id, admin_email: admin.email, action, household_id: householdId, detail });
  if (error) throw new Error(`log admin action: ${error.message}`);
}

/**
 * Gives a household a free Readli Family plan so kids profiles can be tested before payments are on.
 * A household that already has a live plan keeps it; nothing is stacked.
 */
export async function grantTesterPlan(db: SupabaseClient, admin: AdminUser, householdId: string, days: TesterPlanDays, at = new Date()): Promise<void> {
  const { data: home, error } = await db.from("households").select("id, name").eq("id", householdId).maybeSingle();
  if (error) throw new Error(`read family: ${error.message}`);
  if (!home) throw new AdminActionError("That family no longer exists.");
  const { data: plans, error: plansError } = await db
    .from("household_entitlements")
    .select("id, household_id, source, status, starts_at, ends_at")
    .eq("household_id", householdId)
    .eq("status", "active");
  if (plansError) throw new Error(`read plans: ${plansError.message}`);
  if (livePlan(plans ?? [], householdId, at)) throw new AdminActionError(`${home.name} already has a Family plan.`);
  const endsAt = testerPlanEnd(days, at);
  const { error: insertError } = await db.from("household_entitlements").insert({
    household_id: householdId,
    source: "tester",
    status: "active",
    starts_at: at.toISOString(),
    ends_at: endsAt,
    granted_by: admin.id,
    note: `Tester plan from ${admin.email}`,
  });
  if (insertError) throw new Error(`grant tester plan: ${insertError.message}`);
  await log(db, admin, "tester_plan_granted", householdId, { days, endsAt });
}

/** Ends a tester plan now. Only tester plans; paid and gifted plans are never touched from here. */
export async function endTesterPlan(db: SupabaseClient, admin: AdminUser, entitlementId: string, at = new Date()): Promise<void> {
  const { data: plan, error } = await db.from("household_entitlements").select("id, household_id, source, status").eq("id", entitlementId).maybeSingle();
  if (error) throw new Error(`read plan: ${error.message}`);
  if (!plan || plan.source !== "tester" || plan.status !== "active") throw new AdminActionError("Only an active tester plan can be ended here.");
  const { error: updateError } = await db.from("household_entitlements").update({ status: "canceled", ends_at: at.toISOString() }).eq("id", entitlementId);
  if (updateError) throw new Error(`end tester plan: ${updateError.message}`);
  await log(db, admin, "tester_plan_ended", plan.household_id as string, { entitlementId });
}

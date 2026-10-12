"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { accountDb } from "@/lib/family/account-store";
import { requireAdmin, type AdminUser } from "@/lib/admin/access";
import { AdminActionError, endTesterPlan, grantTesterPlan, parseTesterDays } from "@/lib/admin/tester-plans";

/** Runs an admin change after re-checking who is asking, then returns to /admin with the outcome. */
async function asAdmin(run: (ctx: { db: SupabaseClient; admin: AdminUser }) => Promise<string>, back: string) {
  const gate = await requireAdmin("/admin");
  const db = accountDb();
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("Tester plans need Supabase connected.")}`;
  else {
    try {
      outcome = `ok=${encodeURIComponent(await run({ db, admin: gate.admin }))}`;
    } catch (err) {
      if (!(err instanceof AdminActionError)) throw err;
      outcome = `err=${encodeURIComponent(err.message)}`;
    }
  }
  redirect(`/admin?${outcome}${back ? `&q=${encodeURIComponent(back)}` : ""}`);
}

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

export async function grantTesterPlanAction(form: FormData) {
  await asAdmin(async ({ db, admin }) => {
    const days = parseTesterDays(field(form, "days"));
    if (days === undefined) throw new AdminActionError("Pick how long the tester plan lasts.");
    await grantTesterPlan(db, admin, field(form, "householdId"), days);
    return `Gave ${field(form, "name") || "the family"} a tester Family plan${days === null ? "" : ` for ${days} days`}.`;
  }, field(form, "q"));
}

export async function endTesterPlanAction(form: FormData) {
  await asAdmin(async ({ db, admin }) => {
    await endTesterPlan(db, admin, field(form, "entitlementId"));
    return `Ended the tester plan for ${field(form, "name") || "the family"}.`;
  }, field(form, "q"));
}

const COST_FIELDS = ["provider_plan_monthly_usd", "cost_per_1k_chars_usd", "low_cost_per_1k_chars_usd", "storage_usd_per_gb_month", "delivery_usd_per_gb"] as const;

/** Saves the cost assumptions the financial report uses. */
export async function updateCostSettingsAction(form: FormData) {
  const gate = await requireAdmin("/admin/finance");
  const db = accountDb();
  let outcome: string;
  const row: Record<string, unknown> = { id: true, provider_plan_name: field(form, "provider_plan_name").trim().slice(0, 40) || "Creator" };
  for (const key of COST_FIELDS) {
    const n = Number(field(form, key));
    row[key] = field(form, key).trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("Cost settings need Supabase connected.")}`;
  else if (COST_FIELDS.some((k) => row[k] === null)) outcome = `err=${encodeURIComponent("Every cost needs a number of 0 or more.")}`;
  else {
    const { error } = await db.from("finance_settings").upsert({ ...row, updated_at: new Date().toISOString(), updated_by: gate.admin.id }, { onConflict: "id" });
    outcome = error ? `err=${encodeURIComponent(`Couldn't save: ${error.message}`)}` : `ok=${encodeURIComponent("Saved the cost settings.")}`;
  }
  redirect(`/admin/finance?${outcome}`);
}

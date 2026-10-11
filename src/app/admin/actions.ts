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

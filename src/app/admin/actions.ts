"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { accountDb } from "@/lib/family/account-store";
import { requireAdmin, type AdminUser } from "@/lib/admin/access";
import { AdminActionError, endTesterPlan, grantTesterPlan, parseTesterDays } from "@/lib/admin/tester-plans";
import { billingConfig } from "@/lib/billing/config";
import { forfeitHeldCredits, PackRefundError, refundPack, type RefundBasis } from "@/lib/billing/credit-refunds";
import { StripeApi, StripeError } from "@/lib/billing/stripe-api";

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

/**
 * Refunds a credit pack (Kevin, 2026-10-12, decision 2): in full if it's unused and within the refund
 * window, or the unused share of what was paid when an admin approves it or the law requires it.
 */
export async function refundCreditPackAction(form: FormData) {
  const gate = await requireAdmin("/admin/finance");
  const db = accountDb();
  const config = billingConfig();
  const paymentRef = field(form, "payment_ref").trim();
  const basis = field(form, "basis") as RefundBasis;
  const amount = field(form, "amount").trim();
  const cents = amount ? Math.round(Number(amount) * 100) : null;
  const note = field(form, "note").trim().slice(0, 500);
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("Refunds need Supabase connected.")}`;
  else if (config.mode === "off") outcome = `err=${encodeURIComponent("Payments are switched off, so nothing can be refunded here.")}`;
  else if (!/^pi_[A-Za-z0-9]+$/.test(paymentRef)) outcome = `err=${encodeURIComponent("Enter the Stripe payment ID (pi_...) of the pack.")}`;
  else if (cents !== null && !(Number.isFinite(cents) && cents > 0)) outcome = `err=${encodeURIComponent("Enter the amount in dollars, or leave it blank.")}`;
  else {
    const stripe = new StripeApi(config);
    try {
      const done = await refundPack(db, (ref, c, key) => stripe.refund(ref, c, key, { readli_reason: basis }), {
        paymentRef,
        basis,
        cents,
        note,
        admin: gate.admin.email,
        now: new Date(),
      });
      outcome = `ok=${encodeURIComponent(`Refunded $${(done.cents / 100).toFixed(2)}. Stripe returns it to the card; the bank may take a few more days.`)}`;
    } catch (err) {
      if (err instanceof PackRefundError) outcome = `err=${encodeURIComponent(err.message)}`;
      else if (err instanceof StripeError) outcome = `err=${encodeURIComponent(`Stripe refused the refund: ${err.message}`)}`;
      else throw err;
    }
  }
  redirect(`/admin/finance?${outcome}#pack-refund`);
}

/** Removes a household's held purchased credits once an admin has found no law requiring them to be kept or refunded. */
export async function forfeitHeldCreditsAction(form: FormData) {
  const gate = await requireAdmin("/admin/finance");
  const db = accountDb();
  const householdId = field(form, "household_id").trim();
  const note = field(form, "note").trim().slice(0, 500);
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("This needs Supabase connected.")}`;
  else if (!/^[0-9a-f-]{36}$/i.test(householdId)) outcome = `err=${encodeURIComponent("Enter the household ID from the exception.")}`;
  else if (note.length < 5) outcome = `err=${encodeURIComponent("Say what you checked, such as the customer's state.")}`;
  else {
    const removed = await forfeitHeldCredits(db, householdId, { admin: gate.admin.email, note, now: new Date() });
    outcome = `ok=${encodeURIComponent(`Removed ${removed} held credits.`)}`;
  }
  redirect(`/admin/finance?${outcome}#held-credits`);
}

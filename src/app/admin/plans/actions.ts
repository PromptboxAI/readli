"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { parsePriceForm, priceSettingsRow } from "@/lib/billing/price-settings";
import { accountDb } from "@/lib/family/account-store";

/** Saves the prices on /admin/plans. New purchases use them; families already paying keep theirs. */
export async function updatePriceSettingsAction(form: FormData) {
  const gate = await requireAdmin("/admin/plans");
  const db = accountDb();
  const parsed = parsePriceForm((name) => {
    const v = form.get(name);
    return typeof v === "string" ? v : "";
  });
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("Prices can be changed once sign-in and Supabase are connected.")}`;
  else if (!parsed.ok) outcome = `err=${encodeURIComponent(parsed.error)}`;
  else {
    const { error } = await db
      .from("plan_settings")
      .update({ ...priceSettingsRow(parsed.settings), updated_at: new Date().toISOString(), updated_by: gate.admin.id })
      .eq("id", true);
    outcome = error ? `err=${encodeURIComponent(`Couldn't save: ${error.message}`)}` : `ok=${encodeURIComponent("Saved the prices. New purchases use them; families already paying keep theirs.")}`;
  }
  redirect(`/admin/plans?${outcome}`);
}

"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin, type AdminUser } from "@/lib/admin/access";
import { logSupportAction } from "@/lib/admin/family-support";
import { changeEmail, confirmEmail, sendSignInEmail } from "@/lib/admin/support-people";
import { AdminActionError } from "@/lib/admin/tester-plans";
import { accountDb } from "@/lib/family/account-store";

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

const ID = /^[0-9a-f-]{36}$/i;

/** Runs one sign-in fix after re-checking who is asking, then returns to the account with what happened. */
async function forAccount(form: FormData, run: (ctx: { db: SupabaseClient; admin: AdminUser; userId: string }) => Promise<string>) {
  const userId = field(form, "userId");
  const path = `/admin/accounts/${ID.test(userId) ? userId : ""}`;
  const gate = await requireAdmin(path);
  const db = accountDb();
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("Account fixes need sign-in and Supabase connected.")}`;
  else if (!ID.test(userId)) outcome = `err=${encodeURIComponent("That account wasn't found.")}`;
  else {
    try {
      outcome = `ok=${encodeURIComponent(await run({ db, admin: gate.admin, userId }))}`;
    } catch (err) {
      if (!(err instanceof AdminActionError)) console.error("[admin] account fix failed", err);
      outcome = `err=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`;
    }
  }
  redirect(`${path}?${outcome}`);
}

export async function sendSignInAction(form: FormData) {
  await forAccount(form, async ({ db, admin, userId }) => {
    const email = await sendSignInEmail(db, userId);
    await logSupportAction(db, admin, "sign_in_email_sent", null, { userId });
    return `Sent a sign-in email to ${email}. It has a link and a code, and it may take a minute to arrive.`;
  });
}

export async function confirmEmailAction(form: FormData) {
  await forAccount(form, async ({ db, admin, userId }) => {
    const email = await confirmEmail(db, userId);
    await logSupportAction(db, admin, "email_confirmed", null, { userId });
    return `Marked ${email} confirmed.`;
  });
}

export async function changeEmailAction(form: FormData) {
  await forAccount(form, async ({ db, admin, userId }) => {
    const { from, to } = await changeEmail(db, admin, userId, field(form, "email"), field(form, "emailAgain"));
    await logSupportAction(db, admin, "email_changed", null, { userId, from, to });
    return `Changed the sign-in email${from ? ` from ${from}` : ""} to ${to}. They sign in with the new address from now on.`;
  });
}

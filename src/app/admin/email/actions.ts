"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { EmailAdminError, retryFailedEmail, setAllEmailSwitches, setEmailSwitch } from "@/lib/email/admin";
import { emailDefinition } from "@/lib/email/catalog";
import { accountDb } from "@/lib/family/account-store";

const back = (outcome: string) => redirect(`/admin/email?${outcome}`);

async function run(change: (db: NonNullable<ReturnType<typeof accountDb>>, adminId: string) => Promise<string>) {
  const gate = await requireAdmin("/admin/email");
  const db = accountDb();
  if (gate.preview || !db) return back(`err=${encodeURIComponent("Email settings need Supabase connected.")}`);
  let outcome: string;
  try {
    outcome = `ok=${encodeURIComponent(await change(db, gate.admin.id))}`;
  } catch (err) {
    if (!(err instanceof EmailAdminError)) throw err;
    outcome = `err=${encodeURIComponent(err.message)}`;
  }
  back(outcome);
}

export async function setEmailSwitchAction(form: FormData) {
  const emailId = String(form.get("emailId") ?? "");
  const enabled = form.get("enabled") === "on";
  await run(async (db, adminId) => {
    await setEmailSwitch(db, adminId, emailId, enabled);
    return `${emailDefinition(emailId)?.name ?? emailId} is now ${enabled ? "on" : "off"}.`;
  });
}

export async function setAllEmailSwitchesAction(form: FormData) {
  const enabled = form.get("enabled") === "on";
  await run(async (db, adminId) => {
    const count = await setAllEmailSwitches(db, adminId, enabled);
    return `All ${count} emails are now ${enabled ? "on" : "off"}.`;
  });
}

export async function retryEmailAction(form: FormData) {
  const id = String(form.get("id") ?? "");
  await run(async (db) => {
    await retryFailedEmail(db, id);
    return "That email will be tried again on the next hourly run.";
  });
}

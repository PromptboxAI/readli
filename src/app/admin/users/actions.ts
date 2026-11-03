"use server";

import { redirect } from "next/navigation";
import { AccountError } from "@/lib/account/privacy";
import { voiceProvider } from "@/lib/account/server";
import { requireAdmin } from "@/lib/admin/access";
import { AdminActionError } from "@/lib/admin/tester-plans";
import { adminDeleteAccount, setAccountPaused } from "@/lib/admin/users";
import { accountDb } from "@/lib/family/account-store";
import { providerRefCipher } from "@/lib/server/provider-ref";

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

/** Deletes a grown-up's account with the full cleanup, after the admin types its email. */
export async function deleteAccountAction(form: FormData) {
  const gate = await requireAdmin("/admin/users");
  const db = accountDb();
  const q = field(form, "q");
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("Deleting accounts needs sign-in and Supabase connected.")}`;
  else {
    try {
      const email = await adminDeleteAccount({ db, provider: voiceProvider(), refs: providerRefCipher() }, gate.admin, field(form, "userId"), field(form, "confirmEmail"));
      outcome = `ok=${encodeURIComponent(`Deleted ${email}. That email can sign up again now.`)}`;
    } catch (err) {
      if (err instanceof AdminActionError || err instanceof AccountError) outcome = `err=${encodeURIComponent(err instanceof AccountError ? err.userMessage : err.message)}`;
      else throw err;
    }
  }
  redirect(`/admin/users?${outcome}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
}

async function pause(form: FormData, paused: boolean) {
  const gate = await requireAdmin("/admin/users");
  const db = accountDb();
  const q = field(form, "q");
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("Pausing accounts needs sign-in and Supabase connected.")}`;
  else {
    try {
      const email = await setAccountPaused(db, gate.admin, field(form, "userId"), paused);
      outcome = `ok=${encodeURIComponent(paused ? `Paused ${email}. They can't sign in until you unpause them.` : `Unpaused ${email}. They can sign in again.`)}`;
    } catch (err) {
      if (!(err instanceof AdminActionError)) throw err;
      outcome = `err=${encodeURIComponent(err.message)}`;
    }
  }
  redirect(`/admin/users?${outcome}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
}

export async function pauseAccountAction(form: FormData) {
  await pause(form, true);
}

export async function unpauseAccountAction(form: FormData) {
  await pause(form, false);
}

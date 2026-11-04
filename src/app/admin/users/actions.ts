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

/** Back to the same search, filter, sort and page, with the outcome on top. Only known keys survive. */
function back(form: FormData, outcome: string): never {
  const from = new URLSearchParams(field(form, "back"));
  const qs = new URLSearchParams(outcome);
  for (const key of ["q", "show", "sort", "page"]) {
    const v = from.get(key);
    if (v) qs.set(key, v);
  }
  redirect(`/admin/users?${qs}`);
}

/**
 * What the admin sees when a delete stops partway. Every step is safe to repeat, so an unexpected
 * failure is shown and logged instead of crashing the page, and the admin can try again.
 */
function deleteFailure(err: unknown): string {
  if (err instanceof AdminActionError) return err.message;
  if (err instanceof AccountError) return err.userMessage;
  console.error("[admin] account delete failed", err);
  const detail = err instanceof Error ? err.message : String(err);
  return `The delete stopped partway: ${detail}. Anything already removed stays removed, and it's safe to try again.`;
}

/** Deletes a grown-up's account with the full cleanup, after the admin types its email. */
export async function deleteAccountAction(form: FormData) {
  const gate = await requireAdmin("/admin/users");
  const db = accountDb();
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("Deleting accounts needs sign-in and Supabase connected.")}`;
  else {
    try {
      const email = await adminDeleteAccount({ db, provider: voiceProvider(), refs: providerRefCipher() }, gate.admin, field(form, "userId"), field(form, "confirmEmail"));
      outcome = `ok=${encodeURIComponent(`Deleted ${email}. That email can sign up again now.`)}`;
    } catch (err) {
      outcome = `err=${encodeURIComponent(deleteFailure(err))}`;
    }
  }
  back(form, outcome);
}

async function pause(form: FormData, paused: boolean) {
  const gate = await requireAdmin("/admin/users");
  const db = accountDb();
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("Pausing accounts needs sign-in and Supabase connected.")}`;
  else {
    try {
      const email = await setAccountPaused(db, gate.admin, field(form, "userId"), paused);
      outcome = `ok=${encodeURIComponent(paused ? `Paused ${email}. They can't sign in until you unpause them.` : `Unpaused ${email}. They can sign in again.`)}`;
    } catch (err) {
      if (!(err instanceof AdminActionError)) console.error("[admin] account pause failed", err);
      outcome = `err=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`;
    }
  }
  back(form, outcome);
}

export async function pauseAccountAction(form: FormData) {
  await pause(form, true);
}

export async function unpauseAccountAction(form: FormData) {
  await pause(form, false);
}

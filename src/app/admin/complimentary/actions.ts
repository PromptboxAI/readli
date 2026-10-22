"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { claimLink, issueComplimentary, revealCode, revokeAndReplace } from "@/lib/admin/complimentary";
import { AdminActionError } from "@/lib/admin/tester-plans";
import { accountDb } from "@/lib/family/account-store";
import { giftCodeCipher } from "@/lib/gifting/code-cipher";
import { requestOrigin } from "@/lib/invitations/context";

export type IssueResult = { error: string } | null;
export type RowResult = { error: string } | { message: string; code?: string; link?: string } | null;

const NOT_READY = "Complimentary memberships need sign-in and Supabase connected.";

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

async function context(path: string) {
  const gate = await requireAdmin(path);
  const db = accountDb();
  const cipher = giftCodeCipher();
  if (gate.preview || !db || !cipher) return null;
  return { admin: gate.admin, db, cipher };
}

export async function issueComplimentaryAction(_prev: IssueResult, form: FormData): Promise<IssueResult> {
  const ctx = await context("/admin/complimentary");
  if (!ctx) return { error: NOT_READY };
  let batchId: string;
  try {
    ({ batchId } = await issueComplimentary(ctx.db, ctx.admin, {
      requestKey: field(form, "requestKey"),
      months: Number(field(form, "months")),
      sponsor: field(form, "sponsor") === "organization" ? "organization" : "readli",
      organization: field(form, "organization"),
      occasion: field(form, "occasion"),
      eventName: field(form, "eventName"),
      recipient: field(form, "recipient") === "named" ? "named" : "unknown",
      recipientName: field(form, "recipientName"),
      recipientEmail: field(form, "recipientEmail"),
      count: Number(field(form, "count") || "1"),
      message: field(form, "message"),
      label: field(form, "label"),
      claimBy: field(form, "claimBy"),
    }, ctx.cipher));
  } catch (err) {
    if (err instanceof AdminActionError) return { error: err.message };
    throw err;
  }
  redirect(`/admin/complimentary/${batchId}`);
}

export async function revokeAndReplaceAction(batchId: string, giftId: string): Promise<RowResult> {
  const ctx = await context(`/admin/complimentary/${batchId}`);
  if (!ctx) return { error: NOT_READY };
  try {
    const { certificate, replacement } = await revokeAndReplace(ctx.db, ctx.admin, ctx.cipher, giftId);
    revalidatePath(`/admin/complimentary/${batchId}`);
    return { message: `${certificate} is revoked. ${replacement} replaces it with a new code.` };
  } catch (err) {
    if (err instanceof AdminActionError) return { error: err.message };
    throw err;
  }
}

/** The full code and claim link, for "Show full code" and "Copy link". Every reveal is in the audit trail. */
export async function revealCodeAction(batchId: string, giftId: string): Promise<RowResult> {
  const ctx = await context(`/admin/complimentary/${batchId}`);
  if (!ctx) return { error: NOT_READY };
  try {
    const { code } = await revealCode(ctx.db, ctx.admin, ctx.cipher, giftId);
    revalidatePath(`/admin/complimentary/${batchId}`);
    return { message: "Recorded in the audit trail.", code, link: claimLink(await requestOrigin(), code) };
  } catch (err) {
    if (err instanceof AdminActionError) return { error: err.message };
    throw err;
  }
}

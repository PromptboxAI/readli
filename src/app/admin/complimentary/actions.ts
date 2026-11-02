"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import {
  claimLink,
  claimPath,
  EMAIL_OUTCOME_TEXT,
  emailMembership,
  issueComplimentary,
  revealCode,
  revokeAndReplace,
  type EmailOutcome,
  type SendOne,
} from "@/lib/admin/complimentary";
import { AdminActionError } from "@/lib/admin/tester-plans";
import { accountDb } from "@/lib/family/account-store";
import { giftCodeCipher } from "@/lib/gifting/code-cipher";
import { requestOrigin } from "@/lib/invitations/context";
import { queueEmails } from "@/lib/email/outbox";
import { deliverEmails, emailSecret } from "@/lib/email/send";
import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Queues the email in the outbox and sends it now, so the admin sees whether it went. */
function sendNow(db: SupabaseClient): SendOne {
  return async (email) => {
    const secret = emailSecret();
    if (!secret) return "not_set_up";
    const ids = await queueEmails(db, secret, [email]);
    if (!ids.length) return "queued";
    const report = await deliverEmails(db, ids).catch((err) => {
      console.error("complimentary email send failed", err instanceof Error ? err.message : err);
      return { sent: 0, failed: 1, suppressed: 0, canceled: 0, deferred: 0, skipped: 0 };
    });
    if (!report) return "not_set_up";
    if (report.sent) return "sent";
    if (report.canceled) return "switched_off";
    return "queued";
  };
}

export async function issueComplimentaryAction(_prev: IssueResult, form: FormData): Promise<IssueResult> {
  const ctx = await context("/admin/complimentary");
  if (!ctx) return { error: NOT_READY };
  let batchId: string;
  let emailed: EmailOutcome | null = null;
  try {
    let created: boolean;
    ({ batchId, created } = await issueComplimentary(ctx.db, ctx.admin, {
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
    // A named adult with an email gets the claim link straight away. Issuing has already succeeded, so a
    // failed send is reported on the batch page rather than undoing the membership.
    if (created && field(form, "recipient") === "named" && field(form, "recipientEmail").trim()) {
      const { data } = await ctx.db.from("gifts").select("id").eq("batch_id", batchId).limit(1);
      const giftId = (data?.[0] as { id?: string } | undefined)?.id;
      if (giftId) {
        try {
          ({ outcome: emailed } = await emailMembership(ctx.db, ctx.admin, ctx.cipher, await requestOrigin(), giftId, sendNow(ctx.db)));
        } catch (err) {
          console.error("complimentary email failed", err instanceof Error ? err.message : err);
          emailed = "failed";
        }
      }
    }
  } catch (err) {
    if (err instanceof AdminActionError) return { error: err.message };
    throw err;
  }
  redirect(`/admin/complimentary/${batchId}${emailed ? `?emailed=${emailed}` : ""}`);
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
    const { code, program } = await revealCode(ctx.db, ctx.admin, ctx.cipher, giftId);
    revalidatePath(`/admin/complimentary/${batchId}`);
    return { message: "Recorded in the audit trail.", code, link: claimLink(await requestOrigin(), code, claimPath(program)) };
  } catch (err) {
    if (err instanceof AdminActionError) return { error: err.message };
    throw err;
  }
}

/** "Email it": sends an unclaimed membership's claim link to the adult it was issued to. */
export async function emailMembershipAction(batchId: string, giftId: string): Promise<RowResult> {
  const ctx = await context(`/admin/complimentary/${batchId}`);
  if (!ctx) return { error: NOT_READY };
  try {
    const { outcome } = await emailMembership(ctx.db, ctx.admin, ctx.cipher, await requestOrigin(), giftId, sendNow(ctx.db));
    revalidatePath(`/admin/complimentary/${batchId}`);
    return outcome === "sent" || outcome === "queued" ? { message: `${EMAIL_OUTCOME_TEXT[outcome]}.` } : { error: `${EMAIL_OUTCOME_TEXT[outcome]}.` };
  } catch (err) {
    if (err instanceof AdminActionError) return { error: err.message };
    throw err;
  }
}

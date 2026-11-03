"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import {
  cancelMembership,
  claimLink,
  claimPath,
  EMAIL_OUTCOME_TEXT,
  emailBatch,
  emailMembership,
  issueComplimentary,
  organizerEmail,
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
import { billingConfig } from "@/lib/billing/config";
import { StripeApi } from "@/lib/billing/stripe-api";
import { adminDate } from "@/lib/admin/time";

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
  let organizerEmailed: EmailOutcome | null = null;
  let batchEmailed: EmailOutcome | null = null;
  try {
    const named = field(form, "recipient") === "named";
    const organizer = organizerEmail(field(form, "organizerEmail"));
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
    // Unknown winners: the codes and links go to whoever is handing them out.
    if (created && !named && organizer) {
      try {
        ({ outcome: batchEmailed } = await emailBatch(ctx.db, ctx.admin, ctx.cipher, await requestOrigin(), batchId, organizer, sendNow(ctx.db)));
      } catch (err) {
        console.error("complimentary batch email failed", err instanceof Error ? err.message : err);
        batchEmailed = "failed";
      }
    }
    if (created && named && field(form, "recipientEmail").trim()) {
      const { data } = await ctx.db.from("gifts").select("id").eq("batch_id", batchId).limit(1);
      const giftId = (data?.[0] as { id?: string } | undefined)?.id;
      if (giftId) {
        try {
          ({ outcome: emailed, organizerOutcome: organizerEmailed } = await emailMembership(
            ctx.db,
            ctx.admin,
            ctx.cipher,
            await requestOrigin(),
            giftId,
            sendNow(ctx.db),
            new Date(),
            organizer,
          ));
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
  const query = new URLSearchParams();
  if (emailed) query.set("emailed", emailed);
  if (organizerEmailed) query.set("organizer", organizerEmailed);
  if (batchEmailed) query.set("handout", batchEmailed);
  redirect(`/admin/complimentary/${batchId}${query.size ? `?${query}` : ""}`);
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
    // Show the problem on the row instead of crashing the page.
    console.error("email complimentary membership failed", err instanceof Error ? err.message : err);
    return { error: `${EMAIL_OUTCOME_TEXT.failed}.` };
  }
}

/** Cancels a claimed membership: its unused time comes off the family's plan, or off paused Stripe billing. */
export async function cancelMembershipAction(giftId: string): Promise<RowResult> {
  const ctx = await context("/admin/complimentary");
  if (!ctx) return { error: NOT_READY };
  try {
    const config = billingConfig();
    const r = await cancelMembership(ctx.db, ctx.admin, giftId, config.mode === "off" ? null : new StripeApi(config));
    revalidatePath("/admin/complimentary");
    revalidatePath("/admin/complimentary/memberships");
    revalidatePath("/admin");
    const what = r.billingResumed
      ? "Their paid billing now resumes sooner."
      : r.familyEndsAt
        ? `Their Readli Family now ends ${adminDate(r.familyEndsAt)}.`
        : "";
    if (r.followUp) return { error: `Cancelled ${r.certificate}. ${r.followUp}` };
    return { message: `Cancelled ${r.certificate}. ${what}`.trim() };
  } catch (err) {
    if (err instanceof AdminActionError) return { error: err.message };
    console.error("cancel complimentary membership failed", err instanceof Error ? err.message : err);
    return { error: "Something went wrong cancelling it. Nothing was changed if the row still says Active; try again." };
  }
}

/** "Email these to": sends every unclaimed code and link in a batch to whoever hands them out. */
export async function emailBatchAction(batchId: string, _prev: RowResult, form: FormData): Promise<RowResult> {
  const ctx = await context(`/admin/complimentary/${batchId}`);
  if (!ctx) return { error: NOT_READY };
  try {
    const to = field(form, "to");
    const { count, outcome } = await emailBatch(ctx.db, ctx.admin, ctx.cipher, await requestOrigin(), batchId, to, sendNow(ctx.db));
    revalidatePath(`/admin/complimentary/${batchId}`);
    const what = `${count} unclaimed ${count === 1 ? "membership" : "memberships"}`;
    if (outcome === "sent" || outcome === "queued") return { message: `${outcome === "sent" ? "Emailed" : "Queued"} ${what} to ${to.trim()}.` };
    return { error: HANDOUT_FAILED[outcome] };
  } catch (err) {
    if (err instanceof AdminActionError) return { error: err.message };
    console.error("complimentary batch email failed", err instanceof Error ? err.message : err);
    return { error: "That didn't send. Please try again." };
  }
}

const HANDOUT_FAILED: Record<"switched_off" | "not_set_up" | "failed", string> = {
  switched_off: "Not emailed: the give-away email (M3) is switched off in Admin, Email.",
  not_set_up: "Not emailed: email isn't set up on this server.",
  failed: "Not emailed: something went wrong sending it. Please try again.",
};

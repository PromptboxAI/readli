import type { SupabaseClient } from "@supabase/supabase-js";
import { rows, run } from "@/lib/lifecycle/db";
import { suppressionKey, type EmailConfig, type EmailSender } from "./resend";

/**
 * Every Readli email goes through email_outbox: it is queued once (a dedupe key per message and
 * recipient), sent by the worker with the row id as Resend's idempotency key, retried with backoff
 * when Resend is busy or down, and never sent to an address that hard-bounced or complained.
 */

export type EmailTemplate =
  | "family_invite"
  | "sample_invite"
  | "gift_delivery"
  | "gift_redeemed"
  | "payment_failed"
  | "trial_ending"
  | "recovery_day0"
  | "recovery_day20"
  | "recovery_day28"
  | "household_deleted"
  | "recordings_deleted";

export interface QueuedEmail {
  dedupeKey: string;
  template: EmailTemplate;
  subject: string;
  body: string;
  to: { userId: string } | { email: string };
  householdId?: string | null;
  sendAfter?: string;
  data?: Record<string, unknown>;
}

const MAX_ATTEMPTS = 6;

/** Queues emails; a dedupe key that was already queued is left alone. Returns the ids now queued. */
export async function queueEmails(db: SupabaseClient, emails: QueuedEmail[]): Promise<string[]> {
  if (!emails.length) return [];
  const saved = await rows(
    db
      .from("email_outbox")
      .upsert(
        emails.map((e) => ({
          dedupe_key: e.dedupeKey,
          household_id: e.householdId ?? null,
          recipient_user_id: "userId" in e.to ? e.to.userId : null,
          to_email: "email" in e.to ? e.to.email.trim() : null,
          template: e.template,
          subject: e.subject,
          body: e.body,
          template_data: e.data ?? {},
          category: "transactional",
          status: "queued",
          attempts: 0,
          next_attempt_at: e.sendAfter ?? new Date().toISOString(),
          send_after: e.sendAfter ?? new Date().toISOString(),
        })),
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      )
      .select("id"),
    "queue email",
  );
  return saved.map((r) => r.id as string);
}

/** Minutes to wait before attempt n+1. */
export const backoffMinutes = (attempts: number) => Math.min(24 * 60, 5 * 2 ** attempts);

export interface SendReport {
  sent: number;
  failed: number;
  suppressed: number;
  skipped: number;
  errors: string[];
}

export interface OutboxDeps {
  db: SupabaseClient;
  sender: EmailSender | null;
  config: EmailConfig;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  /** Only these rows (e.g. an invitation sent straight away); otherwise every due row. */
  ids?: string[];
}

async function recipientAddress(db: SupabaseClient, row: Record<string, unknown>): Promise<string | null> {
  if (typeof row.to_email === "string" && row.to_email) return row.to_email;
  if (typeof row.recipient_user_id !== "string") return null;
  const { data, error } = await db.auth.admin.getUserById(row.recipient_user_id);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

export async function sendDueEmails(deps: OutboxDeps): Promise<SendReport> {
  const { db, sender, config } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const report: SendReport = { sent: 0, failed: 0, suppressed: 0, skipped: 0, errors: [] };
  if (!sender) return report;

  let query = db
    .from("email_outbox")
    .select("id, recipient_user_id, to_email, template, subject, body, attempts, household_id")
    .in("status", ["queued", "failed"])
    .lte("send_after", now.toISOString())
    .lte("next_attempt_at", now.toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(config.batchSize);
  if (deps.ids) query = query.in("id", deps.ids);
  const due = await rows(query, "read due emails");

  for (const [i, row] of due.entries()) {
    const id = row.id as string;
    const attempts = (row.attempts as number) + 1;
    // Claim the row so two workers never send it twice.
    const claimed = await rows(
      db.from("email_outbox").update({ status: "sending", attempts }).eq("id", id).in("status", ["queued", "failed"]).select("id"),
      "claim email",
    );
    if (!claimed.length) {
      report.skipped += 1;
      continue;
    }
    try {
      const to = await recipientAddress(db, row);
      if (!to) {
        await run(db.from("email_outbox").update({ status: "canceled", last_error: "no_address" }).eq("id", id), "cancel email");
        report.skipped += 1;
        continue;
      }
      const suppressed = await rows(db.from("email_suppressions").select("email_key").eq("email_key", suppressionKey(to)), "read suppressions");
      if (suppressed.length) {
        await run(db.from("email_outbox").update({ status: "suppressed", last_error: "suppressed" }).eq("id", id), "suppress email");
        report.suppressed += 1;
        continue;
      }
      if (!row.subject || !row.body) throw new Error("email has no content");
      const result = await sender.send({ to, subject: row.subject as string, text: row.body as string, tags: { template: row.template as string } }, `outbox-${id}`);
      if (result.ok) {
        await run(db.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), provider_ref: result.id, last_error: null }).eq("id", id), "mark sent");
        report.sent += 1;
      } else {
        const giveUp = !result.retry || attempts >= MAX_ATTEMPTS;
        await run(
          db
            .from("email_outbox")
            .update({ status: "failed", last_error: result.error, ...(giveUp ? { attempts: MAX_ATTEMPTS } : { next_attempt_at: new Date(now.getTime() + backoffMinutes(attempts) * 60_000).toISOString() }) })
            .eq("id", id),
          "mark failed",
        );
        report.failed += 1;
        report.errors.push(`${id}: ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .from("email_outbox")
        .update({ status: "failed", last_error: message.slice(0, 300), next_attempt_at: new Date(now.getTime() + backoffMinutes(attempts) * 60_000).toISOString() })
        .eq("id", id);
      report.failed += 1;
      report.errors.push(`${id}: ${message}`);
    }
    if (i < due.length - 1 && config.spacingMs > 0) await sleep(config.spacingMs);
  }
  return report;
}

/** Records a Resend webhook event once, and suppresses addresses that hard-bounced or complained. */
export async function recordEmailEvent(
  db: SupabaseClient,
  event: { id: string; type: string; data?: { email_id?: string; to?: string[] | string; bounce?: { type?: string } } },
): Promise<{ duplicate: boolean; suppressed: number }> {
  const providerRef = event.data?.email_id ?? null;
  const stored = await rows(
    db
      .from("email_events")
      .upsert({ provider_event_id: event.id, type: event.type, provider_ref: providerRef, payload: event }, { onConflict: "provider_event_id", ignoreDuplicates: true })
      .select("id"),
    "store email event",
  );
  if (!stored.length) return { duplicate: true, suppressed: 0 };
  if (providerRef) {
    await run(db.from("email_outbox").update({ last_event: event.type, last_event_at: new Date().toISOString() }).eq("provider_ref", providerRef), "record email event");
  }
  const bounceType = (event.data?.bounce?.type ?? "").toLowerCase();
  const hardBounce = event.type === "email.bounced" && bounceType !== "transient" && bounceType !== "temporary";
  const complaint = event.type === "email.complained";
  if (!hardBounce && !complaint) return { duplicate: false, suppressed: 0 };
  const to = event.data?.to;
  const addresses = (Array.isArray(to) ? to : to ? [to] : []).filter((a) => typeof a === "string" && a.includes("@"));
  if (addresses.length) {
    await run(
      db.from("email_suppressions").upsert(
        addresses.map((a) => ({ email_key: suppressionKey(a), reason: complaint ? "complaint" : "bounce", source: "resend", detail: { event_id: event.id } })),
        { onConflict: "email_key", ignoreDuplicates: true },
      ),
      "suppress address",
    );
  }
  return { duplicate: false, suppressed: addresses.length };
}

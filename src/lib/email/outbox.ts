import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHash } from "@/lib/invitations/server";
import { MailerError, type Mailer } from "@/lib/invitations/email";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { emailDefinition, type PreferenceTopic } from "./catalog";
import { backoffMinutes, frequencyAllows, MAX_ATTEMPTS, sendWindow } from "./policy";
import { preferencesFor } from "./preferences";

/**
 * Every automated Readli email goes through email_outbox. It is queued once per dedupe key, and every
 * rule is checked again when the worker sends it: the admin switch, the address, bounce and complaint
 * suppression, unsubscribes, the person's preferences and consent, frequency limits and send hours.
 * The row id is Resend's idempotency key, so a retried run never sends twice.
 */

type Row = Record<string, unknown>;

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface QueuedEmail {
  /** The email's id in the sequence matrix (catalog.ts). */
  emailId: string;
  /** One send per key, ever: e.g. `F2:<user id>` or `I1:<invitation id>:1`. */
  dedupeKey: string;
  to: { userId: string } | { email: string };
  householdId?: string | null;
  sendAfter?: Date;
  message: EmailMessage;
}

/** Queues emails; a dedupe key already queued is left alone. Returns the ids queued now. */
export async function queueEmails(db: SupabaseClient, secret: string, emails: QueuedEmail[], now = new Date()): Promise<string[]> {
  if (!emails.length) return [];
  const cipher = new ProviderRefCipher(secret);
  const rows = emails.map((e) => {
    const def = emailDefinition(e.emailId);
    if (!def) throw new Error(`unknown email ${e.emailId}`);
    const at = (e.sendAfter ?? now).toISOString();
    return {
      dedupe_key: e.dedupeKey,
      email_id: def.id,
      category: def.category,
      household_id: e.householdId ?? null,
      recipient_user_id: "userId" in e.to ? e.to.userId : null,
      to_email_encrypted: "email" in e.to ? cipher.encrypt(e.to.email.trim()) : null,
      subject: e.message.subject,
      html: e.message.html,
      body: e.message.text,
      headers: e.message.headers ?? {},
      send_after: at,
      next_attempt_at: at,
    };
  });
  const saved = await q(db.from("email_outbox").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id"), "queue email");
  return saved.map((r) => r.id as string);
}

/** The key a bounced or complaining address is kept under: a hash, so the list holds no addresses. */
export function deliverySuppressionKey(email: string): string {
  return createHash("sha256").update(`suppress:${email.trim().toLowerCase()}`).digest("hex");
}

/** Admin switches; an email with no row is off. */
export async function enabledEmails(db: SupabaseClient): Promise<Set<string>> {
  const rows = await q(db.from("email_switches").select("email_id, enabled"), "read email switches");
  return new Set(rows.filter((r) => r.enabled === true).map((r) => r.email_id as string));
}

export interface SendReport {
  sent: number;
  failed: number;
  suppressed: number;
  canceled: number;
  deferred: number;
  skipped: number;
}

export interface OutboxDeps {
  db: SupabaseClient;
  mailer: Mailer | null;
  secret: string;
  now?: () => Date;
  batchSize?: number;
  spacingMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Only these rows; otherwise every due row. */
  ids?: string[];
}

type Outcome =
  | { kind: "send"; to: string }
  | { kind: "cancel"; reason: string }
  | { kind: "suppress"; reason: string }
  | { kind: "defer"; until: Date; reason: string };

async function recipientAddress(db: SupabaseClient, cipher: ProviderRefCipher, row: Row): Promise<string | null> {
  if (typeof row.to_email_encrypted === "string" && row.to_email_encrypted) {
    try {
      return cipher.decrypt(row.to_email_encrypted);
    } catch {
      return null;
    }
  }
  if (typeof row.recipient_user_id !== "string") return null;
  const { data, error } = await db.auth.admin.getUserById(row.recipient_user_id);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

/** Every send-time rule, in order. Nothing here sends. */
async function decide(db: SupabaseClient, secret: string, cipher: ProviderRefCipher, switches: Set<string>, row: Row, now: Date): Promise<Outcome> {
  const def = emailDefinition(row.email_id as string);
  if (!def) return { kind: "cancel", reason: "unknown_email" };
  if (!switches.has(def.id)) return { kind: "cancel", reason: "switched_off" };
  const to = await recipientAddress(db, cipher, row);
  if (!to) return { kind: "cancel", reason: "no_address" };

  const bounced = await q(db.from("email_delivery_suppressions").select("email_hash").eq("email_hash", deliverySuppressionKey(to)).limit(1), "read delivery suppressions");
  if (bounced.length) return { kind: "suppress", reason: "bounce_or_complaint" };
  if (def.category === "transactional") return { kind: "send", to };

  // "Stop all Readli invitations" (or a report) stops invitation reminders too; a bounce or complaint
  // recorded there stops every optional email.
  const invitationStops = await q(
    db.from("email_suppressions").select("reason").eq("email_hash", emailHash(secret, to)).is("contributor_id", null).in("reason", ["unsubscribed", "reported", "bounced", "complained"]),
    "read invitation unsubscribes",
  );
  const reasons = new Set(invitationStops.map((r) => r.reason as string));
  if (reasons.has("bounced") || reasons.has("complained")) return { kind: "suppress", reason: "bounce_or_complaint" };
  if (def.sequence === "invitation_reminders" && def.topic === "invitation_reminders" && reasons.size) return { kind: "suppress", reason: "unsubscribed" };

  const userId = typeof row.recipient_user_id === "string" ? row.recipient_user_id : null;
  const prefs = userId ? await preferencesFor(db, userId) : null;
  if (def.category === "commercial" && !prefs?.marketing) return { kind: "suppress", reason: "no_marketing_consent" };
  if (prefs && def.topic && !prefs[def.topic as PreferenceTopic]) return { kind: "suppress", reason: "preference_off" };

  if (userId) {
    const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const earlier = await q(
      db.from("email_outbox").select("sent_at").eq("recipient_user_id", userId).eq("status", "sent").neq("category", "transactional").gte("sent_at", since),
      "read recent email",
    );
    const freq = frequencyAllows(earlier.map((r) => new Date(r.sent_at as string)), now);
    if (!freq.ok) return { kind: "defer", until: sendWindow(freq.retryAt, prefs?.timeZone), reason: "frequency_limit" };
  }
  const window = sendWindow(now, prefs?.timeZone);
  if (window.getTime() > now.getTime()) return { kind: "defer", until: window, reason: "send_hours" };
  return { kind: "send", to };
}

export async function sendDueEmails(deps: OutboxDeps): Promise<SendReport> {
  const { db, mailer, secret } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const report: SendReport = { sent: 0, failed: 0, suppressed: 0, canceled: 0, deferred: 0, skipped: 0 };
  if (!mailer) return report;
  const cipher = new ProviderRefCipher(secret);
  const switches = await enabledEmails(db);

  let query = db
    .from("email_outbox")
    .select("id, email_id, category, recipient_user_id, to_email_encrypted, subject, html, body, headers, attempts")
    .in("status", ["queued", "failed"])
    .lte("next_attempt_at", now.toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("next_attempt_at")
    .limit(deps.batchSize ?? 100);
  if (deps.ids) query = query.in("id", deps.ids);
  const due = await q(query, "read due emails");

  for (const [i, row] of due.entries()) {
    const id = row.id as string;
    const attempts = (row.attempts as number) + 1;
    // Claim the row so two workers never send it twice.
    const claimed = await q(db.from("email_outbox").update({ status: "sending", attempts }).eq("id", id).in("status", ["queued", "failed"]).select("id"), "claim email");
    if (!claimed.length) {
      report.skipped += 1;
      continue;
    }
    const set = (values: Row, what: string) => q(db.from("email_outbox").update(values).eq("id", id), what);
    try {
      const outcome = await decide(db, secret, cipher, switches, row, now);
      if (outcome.kind === "cancel") {
        await set({ status: "canceled", last_error: outcome.reason }, "cancel email");
        report.canceled += 1;
        continue;
      }
      if (outcome.kind === "suppress") {
        await set({ status: "suppressed", last_error: outcome.reason }, "suppress email");
        report.suppressed += 1;
        continue;
      }
      if (outcome.kind === "defer") {
        // Waiting isn't an attempt.
        await set({ status: "queued", attempts: attempts - 1, next_attempt_at: outcome.until.toISOString(), last_error: outcome.reason }, "defer email");
        report.deferred += 1;
        continue;
      }
      const sent = await mailer.send({
        to: outcome.to,
        subject: row.subject as string,
        html: row.html as string,
        text: row.body as string,
        headers: (row.headers as Record<string, string>) ?? {},
        idempotencyKey: `outbox-${id}`,
      });
      await set({ status: "sent", sent_at: new Date().toISOString(), provider_ref: sent.id || null, last_error: null }, "mark sent");
      report.sent += 1;
    } catch (err) {
      // Rate limits, outages and network errors are retried; a rejected address or payload is not.
      const status = err instanceof MailerError ? err.status : undefined;
      const retry = status === undefined || status === 429 || status >= 500;
      const giveUp = !retry || attempts >= MAX_ATTEMPTS;
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      await set(
        { status: "failed", last_error: message, ...(giveUp ? { attempts: MAX_ATTEMPTS } : { next_attempt_at: new Date(now.getTime() + backoffMinutes(attempts) * 60_000).toISOString() }) },
        "mark failed",
      ).catch(() => undefined);
      report.failed += 1;
    }
    if (i < due.length - 1 && (deps.spacingMs ?? 0) > 0) await sleep(deps.spacingMs!);
  }
  return report;
}

/** Records a Resend webhook event once, and suppresses addresses that hard-bounced or complained. */
export async function recordEmailEvent(
  db: SupabaseClient,
  event: { id: string; type: string; data?: { email_id?: string; to?: string[] | string; bounce?: { type?: string } } },
): Promise<{ duplicate: boolean; suppressed: number }> {
  const providerRef = event.data?.email_id ?? null;
  const stored = await q(
    db.from("email_events").upsert({ provider_event_id: event.id, type: event.type, provider_ref: providerRef }, { onConflict: "provider_event_id", ignoreDuplicates: true }).select("id"),
    "store email event",
  );
  if (!stored.length) return { duplicate: true, suppressed: 0 };
  if (providerRef) {
    await q(db.from("email_outbox").update({ last_event: event.type, last_event_at: new Date().toISOString() }).eq("provider_ref", providerRef), "record email event");
  }
  const bounceType = (event.data?.bounce?.type ?? "").toLowerCase();
  const hardBounce = event.type === "email.bounced" && bounceType !== "transient" && bounceType !== "temporary";
  const complaint = event.type === "email.complained";
  if (!hardBounce && !complaint) return { duplicate: false, suppressed: 0 };
  const to = event.data?.to;
  const addresses = (Array.isArray(to) ? to : to ? [to] : []).filter((a) => typeof a === "string" && a.includes("@"));
  if (addresses.length) {
    await q(
      db.from("email_delivery_suppressions").upsert(
        addresses.map((a) => ({ email_hash: deliverySuppressionKey(a), reason: complaint ? "complaint" : "bounce", source: "resend", detail: { event_id: event.id } })),
        { onConflict: "email_hash", ignoreDuplicates: true },
      ),
      "suppress address",
    );
  }
  return { duplicate: false, suppressed: addresses.length };
}

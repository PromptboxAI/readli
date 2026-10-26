import type { SupabaseClient } from "@supabase/supabase-js";
import { EMAILS, emailDefinition } from "./catalog";
import { MAX_ATTEMPTS } from "./policy";

/**
 * The admin email dashboard (Kevin, 2026-10-24, point 13): what is scheduled, sent, delivered, bounced,
 * suppressed or failed, per email in the sequence matrix, plus each email's switch and a retry for
 * failed sends. It never reads a message body, a link or an address, so no token or recording shows.
 */

type Row = Record<string, unknown>;

export type DashboardState = "scheduled" | "sending" | "sent" | "delivered" | "bounced" | "complained" | "suppressed" | "failed" | "canceled";

export const STATE_LABELS: Record<DashboardState, string> = {
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  bounced: "Bounced",
  complained: "Marked as spam",
  suppressed: "Suppressed",
  failed: "Failed",
  canceled: "Canceled",
};

/** One outbox row as the dashboard shows it. Resend's delivery events refine "sent". */
export function dashboardState(row: Row): DashboardState {
  const status = row.status as string;
  if (status === "queued") return "scheduled";
  if (status === "sent") {
    if (row.last_event === "email.bounced") return "bounced";
    if (row.last_event === "email.complained") return "complained";
    if (row.last_event === "email.delivered") return "delivered";
    return "sent";
  }
  if (status === "failed") return (row.attempts as number) >= MAX_ATTEMPTS ? "failed" : "scheduled";
  return status as DashboardState;
}

export interface DashboardEmail {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  counts: Record<DashboardState, number>;
}

export interface DashboardRow {
  id: string;
  emailId: string;
  emailName: string;
  recipient: string;
  state: DashboardState;
  attempts: number;
  reason: string | null;
  at: string;
  canRetry: boolean;
}

export interface EmailDashboard {
  days: number;
  totals: Record<DashboardState, number>;
  emails: DashboardEmail[];
  recent: DashboardRow[];
}

const zero = (): Record<DashboardState, number> => ({ scheduled: 0, sending: 0, sent: 0, delivered: 0, bounced: 0, complained: 0, suppressed: 0, failed: 0, canceled: 0 });

/** Who it went to, without the address: an account's short id, or that it was a typed-in address. */
function recipientLabel(row: Row): string {
  return typeof row.recipient_user_id === "string" ? `account ${row.recipient_user_id.slice(0, 8)}` : "typed-in address";
}

export async function loadEmailDashboard(db: SupabaseClient, opts: { days?: number; state?: DashboardState | null; emailId?: string | null; now?: Date } = {}): Promise<EmailDashboard> {
  const days = opts.days ?? 30;
  const since = new Date((opts.now ?? new Date()).getTime() - days * 86_400_000).toISOString();
  const [outbox, switches] = await Promise.all([
    db
      .from("email_outbox")
      .select("id, email_id, category, recipient_user_id, status, attempts, last_error, last_event, created_at, sent_at, next_attempt_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000),
    db.from("email_switches").select("email_id, enabled"),
  ]);
  if (outbox.error) throw new Error(`read outbox: ${outbox.error.message}`);
  if (switches.error) throw new Error(`read email switches: ${switches.error.message}`);
  const on = new Set(((switches.data ?? []) as Row[]).filter((r) => r.enabled === true).map((r) => r.email_id as string));
  const rows = (outbox.data ?? []) as Row[];

  const totals = zero();
  const per = new Map(EMAILS.map((e) => [e.id, zero()]));
  for (const r of rows) {
    const state = dashboardState(r);
    totals[state] += 1;
    const counts = per.get(r.email_id as string);
    if (counts) counts[state] += 1;
  }
  const recent = rows
    .filter((r) => (!opts.state || dashboardState(r) === opts.state) && (!opts.emailId || r.email_id === opts.emailId))
    .slice(0, 100)
    .map((r) => {
      const state = dashboardState(r);
      return {
        id: r.id as string,
        emailId: r.email_id as string,
        emailName: emailDefinition(r.email_id as string)?.name ?? (r.email_id as string),
        recipient: recipientLabel(r),
        state,
        attempts: r.attempts as number,
        reason: (r.last_error as string | null) ?? null,
        at: ((state === "scheduled" ? r.next_attempt_at : r.sent_at) ?? r.created_at) as string,
        canRetry: state === "failed",
      };
    });
  return {
    days,
    totals,
    emails: EMAILS.map((e) => ({ id: e.id, name: e.name, category: e.category, enabled: on.has(e.id), counts: per.get(e.id)! })),
    recent,
  };
}

export class EmailAdminError extends Error {}

/**
 * Sends a failed email again on the next run. Only a failed row: a sent email is never resent, and a
 * suppressed or canceled one stays stopped. Every send-time rule is checked again when it goes.
 */
export async function retryFailedEmail(db: SupabaseClient, id: string, now = new Date()): Promise<void> {
  const { data, error } = await db
    .from("email_outbox")
    .update({ status: "queued", attempts: 0, next_attempt_at: now.toISOString(), last_error: null })
    .eq("id", id)
    .eq("status", "failed")
    .select("id");
  if (error) throw new Error(`retry email: ${error.message}`);
  if (!(data ?? []).length) throw new EmailAdminError("Only a failed email can be retried.");
}

export async function setEmailSwitch(db: SupabaseClient, adminId: string, emailId: string, enabled: boolean, now = new Date()): Promise<void> {
  if (!emailDefinition(emailId)) throw new EmailAdminError("That email isn't in the sequence matrix.");
  const { error } = await db
    .from("email_switches")
    .upsert({ email_id: emailId, enabled, updated_by: adminId, updated_at: now.toISOString() }, { onConflict: "email_id" });
  if (error) throw new Error(`save email switch: ${error.message}`);
}

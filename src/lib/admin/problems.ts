import type { SupabaseClient } from "@supabase/supabase-js";
import { bookText } from "@/lib/narration/text";
import { refundLotId, STUCK_AFTER_MS } from "@/lib/narration/support";

/**
 * The support problems queue (Kevin, 2026-11-08): what's going wrong across every family right now,
 * each linked to the family page where support fixes it. Read-only.
 */

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);

async function rows(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<Row[]> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as Row[];
}

/** A query that may fail because its table isn't there yet counts as empty. */
async function maybe(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await p;
  return error ? [] : ((data ?? []) as Row[]);
}

export interface ProblemJob {
  id: string;
  householdId: string;
  family: string;
  bookSlug: string;
  book: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  sentences: number;
  ready: number;
  lastStoredAt: string | null;
  error: string | null;
  /** Readli prepared it at its own cost. */
  free: boolean;
  refunded: boolean;
}

export interface Problems {
  stuck: ProblemJob[];
  failed: ProblemJob[];
  failedEmails: number;
  paymentErrors: { at: string; type: string; error: string }[];
  lockedDevices: { householdId: string; family: string; label: string; until: string }[];
}

export const FAILED_DAYS = 30;

export async function supportProblems(db: SupabaseClient, now = new Date()): Promise<Problems> {
  const since = new Date(now.getTime() - FAILED_DAYS * 86_400_000).toISOString();
  const [active, failed, emails, payments, devices] = await Promise.all([
    rows(db.from("narration_jobs").select("id, library_key, household_id, sentence_ids, reservations, status, created_at, finished_at").in("status", ["queued", "running"]).limit(500), "read running preparations"),
    rows(
      db.from("narration_jobs").select("id, library_key, household_id, sentence_ids, reservations, status, created_at, finished_at").eq("status", "failed").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
      "read failed preparations",
    ),
    maybe(db.from("email_outbox").select("id").eq("status", "failed").gte("created_at", new Date(now.getTime() - 7 * 86_400_000).toISOString()).limit(1000)),
    maybe(db.from("payment_events").select("received_at, type, error").not("error", "is", null).gte("received_at", since).order("received_at", { ascending: false }).limit(50)),
    maybe(db.from("kids_devices").select("household_id, label, pin_locked_until").is("revoked_at", null).gt("pin_locked_until", now.toISOString()).limit(100)),
  ]);
  const jobs = [...active, ...failed];
  const jobIds = jobs.map((j) => j.id as string);
  const homeIds = [...new Set([...jobs.map((j) => j.household_id as string), ...devices.map((d) => d.household_id as string)])];
  const keys = [...new Set(jobs.map((j) => j.library_key as string))];
  const [segs, homes, libs, refunds] = await Promise.all([
    jobIds.length ? rows(db.from("narration_segments").select("job_id, status, storage_key, ready_at, error").in("job_id", jobIds).limit(20000), "read preparation progress") : Promise.resolve([] as Row[]),
    homeIds.length ? rows(db.from("households").select("id, name").in("id", homeIds), "read families") : Promise.resolve([] as Row[]),
    keys.length ? rows(db.from("narration_libraries").select("key, book_slug").in("key", keys), "read audiobooks") : Promise.resolve([] as Row[]),
    failed.length ? rows(db.from("narration_credit_lots").select("id").in("id", failed.map((j) => refundLotId(j.id as string))), "read refunds") : Promise.resolve([] as Row[]),
  ]);
  const family = (id: unknown) => (homes.find((h) => h.id === id)?.name as string | undefined) ?? "A removed family";
  const refunded = new Set(refunds.map((r) => r.id as string));
  const view = (j: Row): ProblemJob => {
    const mine = segs.filter((s) => s.job_id === j.id);
    const last = mine.reduce((max, s) => (typeof s.ready_at === "string" && s.ready_at > max ? s.ready_at : max), "");
    const slug = (libs.find((l) => l.key === j.library_key)?.book_slug as string | undefined) ?? "";
    const reservations = (j.reservations ?? {}) as Record<string, unknown[]>;
    return {
      id: j.id as string,
      householdId: j.household_id as string,
      family: family(j.household_id),
      bookSlug: slug,
      book: bookText(slug)?.title ?? (slug || "A book"),
      status: String(j.status),
      createdAt: String(j.created_at),
      finishedAt: str(j.finished_at),
      sentences: ((j.sentence_ids as string[]) ?? []).length,
      ready: mine.filter((s) => s.status === "ready" && s.storage_key).length,
      lastStoredAt: last || null,
      error: str(mine.find((s) => s.status === "failed" && s.error)?.error),
      free: Object.values(reservations).every((d) => !d?.length),
      refunded: refunded.has(refundLotId(j.id as string)),
    };
  };
  const stuck = active
    .map(view)
    .filter((j) => now.getTime() - Date.parse(j.lastStoredAt ?? j.createdAt) > STUCK_AFTER_MS)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return {
    stuck,
    failed: failed.map(view),
    failedEmails: emails.length,
    paymentErrors: payments.map((p) => ({ at: String(p.received_at), type: String(p.type), error: String(p.error) })),
    lockedDevices: devices.map((d) => ({ householdId: d.household_id as string, family: family(d.household_id), label: String(d.label), until: String(d.pin_locked_until) })),
  };
}

export interface SupportEmail {
  at: string;
  subject: string;
  status: string;
  sentAt: string | null;
  lastEvent: string | null;
  error: string | null;
  to: string | null;
}

/** Recent emails to a family or to one grown-up, for "I never got the email". Missing outbox counts as none. */
export async function supportEmails(db: SupabaseClient, by: { householdId?: string; userId?: string }, limit = 30): Promise<SupportEmail[]> {
  let q = db.from("email_outbox").select("created_at, subject, status, sent_at, last_event, last_error, recipient_user_id");
  if (by.householdId) q = q.eq("household_id", by.householdId);
  if (by.userId) q = q.eq("recipient_user_id", by.userId);
  const found = await maybe(q.order("created_at", { ascending: false }).limit(limit));
  return found.map((e) => ({
    at: String(e.created_at),
    subject: String(e.subject),
    status: String(e.status),
    sentAt: str(e.sent_at),
    lastEvent: str(e.last_event),
    error: str(e.last_error),
    to: str(e.recipient_user_id),
  }));
}

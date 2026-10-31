import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentWeek, featuredBooks } from "./bedtime";
import { queueEmails, type QueuedEmail } from "./outbox";
import { preferencesUrl, unsubscribeHeaders } from "./preferences";
import type { SequenceContext } from "./sequences";
import { readliEmail } from "./templates";

/**
 * Feedback (FB1) and win-back (W1, W2), switched off in /admin until tested (Kevin, 2026-10-24,
 * point 12). FB1 asks every Family household the same question 21 days after its first story,
 * whatever they might think, and everyone who answers sees the same thanks (point 11). W1 and W2 go
 * after two and four quiet weeks, only with marketing consent. The trigger uses when stories played;
 * no email says what a child listened to, how often, or a child's name (point 10).
 */

type Row = Record<string, unknown>;

const DAY = 86_400_000;
export const FEEDBACK_EVERY_DAYS = 180;
export type Ask = "FB1" | "W2";

export const W2_REASONS = [
  { id: "busy", label: "Our evenings got busy" },
  { id: "kids", label: "The kids weren't into it" },
  { id: "books", label: "Not enough stories we wanted" },
  { id: "voices", label: "Voices didn't sound right" },
  { id: "price", label: "The price" },
  { id: "tech", label: "Something didn't work" },
  { id: "other", label: "Something else" },
] as const;

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

const ago = (now: Date, ms: number) => new Date(now.getTime() - ms).toISOString();

const mac = (secret: string, payload: string) => createHmac("sha256", `readli-feedback:${secret}`).update(payload).digest("base64url").slice(0, 32);

/** A link token naming one grown-up, one household and which question, so /feedback works without signing in. */
export const feedbackToken = (secret: string, userId: string, householdId: string, ask: Ask) => `${userId}.${householdId}.${ask}.${mac(secret, `${userId}.${householdId}.${ask}`)}`;

export function fromFeedbackToken(secret: string, token: unknown): { userId: string; householdId: string; ask: Ask } | null {
  if (typeof token !== "string") return null;
  const [userId, householdId, ask, given] = token.split(".");
  if (!userId || !householdId || !given || (ask !== "FB1" && ask !== "W2")) return null;
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(householdId)) return null;
  const a = Buffer.from(given);
  const b = Buffer.from(mac(secret, `${userId}.${householdId}.${ask}`));
  return a.length === b.length && timingSafeEqual(a, b) ? { userId, householdId, ask } : null;
}

export const feedbackUrl = (base: string, secret: string, userId: string, householdId: string, ask: Ask) =>
  `${base.replace(/\/$/, "")}/feedback?t=${encodeURIComponent(feedbackToken(secret, userId, householdId, ask))}`;

export class FeedbackError extends Error {}

export async function saveFeedback(db: SupabaseClient, who: { userId: string; householdId: string; ask: Ask }, input: { score?: unknown; reason?: unknown; comment?: unknown }, now = new Date()): Promise<void> {
  const comment = typeof input.comment === "string" ? input.comment.trim().slice(0, 2000) : "";
  const score = who.ask === "FB1" && Number.isInteger(input.score) && (input.score as number) >= 0 && (input.score as number) <= 10 ? (input.score as number) : null;
  const reason = who.ask === "W2" && W2_REASONS.some((r) => r.id === input.reason) ? (input.reason as string) : null;
  if (score === null && reason === null && !comment) throw new FeedbackError(who.ask === "FB1" ? "Pick a number from 0 to 10." : "Pick an answer or write a few words.");
  const { error } = await db
    .from("feedback_responses")
    .insert({ user_id: who.userId, household_id: who.householdId, ask: who.ask, score, reason, comment: comment || null, created_at: now.toISOString() });
  if (error) throw new Error(`save feedback: ${error.message}`);
}

interface Home {
  id: string;
  ownerId: string;
  name: string;
}

/** Each household's creator, while they still look after it, and their first name. */
async function owners(db: SupabaseClient, ids: string[]): Promise<Home[]> {
  if (!ids.length) return [];
  const homes = await q(db.from("households").select("id, created_by").in("id", ids), "read households");
  const guardians = new Set(
    (await q(db.from("household_members").select("household_id, user_id").in("household_id", ids).eq("role", "guardian").is("removed_at", null), "read guardians")).map((m) => `${m.household_id}:${m.user_id}`),
  );
  const people = homes.map((h) => h.created_by as string);
  const names = new Map(
    (await q(db.from("adult_profiles").select("user_id, display_name").in("user_id", people), "read names")).map((r) => [r.user_id as string, String(r.display_name ?? "").trim().split(/\s+/)[0] ?? ""]),
  );
  return homes.filter((h) => guardians.has(`${h.id}:${h.created_by}`)).map((h) => ({ id: h.id as string, ownerId: h.created_by as string, name: names.get(h.created_by as string) ?? "" }));
}

/** FB1: 21 days after a household's first story played, unless they were asked in the last 180 days. */
export async function feedbackRequests(ctx: SequenceContext): Promise<QueuedEmail[]> {
  if (!ctx.enabled.has("FB1")) return [];
  const recent = await q(ctx.db.from("listening_sessions").select("household_id, started_at").gte("started_at", ago(ctx.now, 28 * DAY)).lte("started_at", ago(ctx.now, 21 * DAY)), "read listening");
  const ids = [...new Set(recent.map((r) => r.household_id as string))];
  if (!ids.length) return [];
  const earlier = new Set((await q(ctx.db.from("listening_sessions").select("household_id").in("household_id", ids).lt("started_at", ago(ctx.now, 28 * DAY)), "read listening")).map((r) => r.household_id as string));
  const homes = await owners(ctx.db, ids.filter((id) => !earlier.has(id)));
  const asked = new Set(
    (await q(ctx.db.from("email_outbox").select("recipient_user_id").eq("email_id", "FB1").in("recipient_user_id", homes.map((h) => h.ownerId)).gte("created_at", ago(ctx.now, FEEDBACK_EVERY_DAYS * DAY)), "read asked")).map((r) => r.recipient_user_id as string),
  );
  return homes
    .filter((h) => !asked.has(h.ownerId))
    .map((h) => ({
      emailId: "FB1",
      dedupeKey: `FB1:${h.id}`,
      to: { userId: h.ownerId },
      householdId: h.id,
      message: readliEmail({
        subject: "How are bedtimes going?",
        name: h.name,
        title: "How are bedtimes going with Readli?",
        paragraphs: [
          "You've been reading with Readli for a few weeks now, and we'd love to hear how it's going! One quick question: how likely are you to recommend it to another family, from 0 to 10?",
          "Every answer helps us make bedtime even better. There's room to tell us more if you'd like.",
        ],
        cta: { label: "Answer one question", url: feedbackUrl(ctx.base, ctx.secret, h.ownerId, h.id, "FB1") },
        reason: "You're getting this because you look after a Readli Family plan.",
        preferencesUrl: preferencesUrl(ctx.base, ctx.secret, h.ownerId),
        headers: unsubscribeHeaders(ctx.base, ctx.secret, h.ownerId, "feedback_requests"),
        stopLabel: "Stop feedback requests",
      }),
    }));
}

/** Households with a plan or trial whose most recent story was between `fromDays` and `toDays` ago. */
async function quietHouseholds(db: SupabaseClient, now: Date, fromDays: number, toDays: number): Promise<Map<string, string>> {
  const at = now.toISOString();
  const plans = await q(db.from("household_entitlements").select("household_id, ends_at").eq("status", "active"), "read plans");
  const ids = [...new Set(plans.filter((p) => !p.ends_at || (p.ends_at as string) > at).map((p) => p.household_id as string))];
  if (!ids.length) return new Map();
  const last = new Map<string, string>();
  for (const s of await q(db.from("listening_sessions").select("household_id, last_seen_at").in("household_id", ids).gte("last_seen_at", ago(now, (toDays + 30) * DAY)), "read listening")) {
    const h = s.household_id as string;
    if (!last.has(h) || (s.last_seen_at as string) > last.get(h)!) last.set(h, s.last_seen_at as string);
  }
  return new Map([...last].filter(([, seen]) => seen <= ago(now, fromDays * DAY) && seen > ago(now, toDays * DAY)));
}

function winBackMessage(ctx: SequenceContext, h: Home, m: { subject: string; title: string; paragraphs: string[]; cta: { label: string; url: string }; books?: Parameters<typeof readliEmail>[0]["books"] }) {
  return readliEmail({
    ...m,
    name: h.name,
    reason: "You're getting this because you asked for Bedtime Thursdays and Readli news.",
    preferencesUrl: preferencesUrl(ctx.base, ctx.secret, h.ownerId),
    headers: unsubscribeHeaders(ctx.base, ctx.secret, h.ownerId, "marketing"),
    footerLabel: "Unsubscribe or change your email settings",
  });
}

/** W1 after two quiet weeks (this week's two stories), W2 after four (what got in the way). Marketing consent is checked when sending. */
export async function winBack(ctx: SequenceContext): Promise<QueuedEmail[]> {
  const out: QueuedEmail[] = [];
  const base = ctx.base.replace(/\/$/, "");
  if (ctx.enabled.has("W1")) {
    const quiet = await quietHouseholds(ctx.db, ctx.now, 14, 21);
    const featured = quiet.size ? await featuredBooks(ctx.db, currentWeek(ctx.now)) : null;
    for (const h of await owners(ctx.db, [...quiet.keys()])) {
      out.push({
        emailId: "W1",
        dedupeKey: `W1:${h.id}:${quiet.get(h.id)!.slice(0, 10)}`,
        to: { userId: h.ownerId },
        householdId: h.id,
        message: winBackMessage(ctx, h, {
          subject: "Two new stories are waiting for bedtime",
          title: "New stories for this week's bedtimes",
          paragraphs: ["We've missed you! Two brand-new stories just landed in the Readli library, ready to be read in the voices your kids love."],
          books: featured?.books.map((b) => ({ title: b.title, byline: b.author, url: `${base}/family/books/${b.slug}`, imageUrl: b.coverUrl ? `${base}${b.coverUrl}` : null })),
          cta: { label: "Find tonight's story", url: `${base}/family/books` },
        }),
      });
    }
  }
  if (ctx.enabled.has("W2")) {
    const quiet = await quietHouseholds(ctx.db, ctx.now, 28, 35);
    for (const h of await owners(ctx.db, [...quiet.keys()])) {
      out.push({
        emailId: "W2",
        dedupeKey: `W2:${h.id}:${quiet.get(h.id)!.slice(0, 10)}`,
        to: { userId: h.ownerId },
        householdId: h.id,
        message: winBackMessage(ctx, h, {
          subject: "Did Readli fit your family's evenings?",
          title: "Did Readli fit your family's evenings?",
          paragraphs: ["Evenings change, and not every family settles into the same routine. If something got in the way, we'd like to know. It takes one tap."],
          cta: { label: "Tell us what got in the way", url: feedbackUrl(base, ctx.secret, h.ownerId, h.id, "W2") },
        }),
      });
    }
  }
  return out;
}

export async function queueFeedbackEmails(ctx: SequenceContext): Promise<{ queued: number; errors: string[] }> {
  const errors: string[] = [];
  const all: QueuedEmail[] = [];
  for (const [id, run] of [
    ["FB1", feedbackRequests],
    ["W1/W2", winBack],
  ] as const) {
    try {
      all.push(...(await run(ctx)));
    } catch (err) {
      errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { queued: (await queueEmails(ctx.db, ctx.secret, all, ctx.now)).length, errors };
}

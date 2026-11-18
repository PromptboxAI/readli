import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHash } from "@/lib/invitations/server";
import { findCatalogBook, NEWEST_BOOKS, type CatalogBook } from "@/lib/library/catalog";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { queueEmails, type QueuedEmail } from "./outbox";
import { DEFAULT_TIME_ZONE, validTimeZone } from "./policy";
import { contactUnsubscribeUrl, preferencesUrl, unsubscribeHeaders } from "./preferences";
import type { SequenceContext } from "./sequences";
import { readliEmail } from "./templates";

/**
 * Bedtime Thursdays (Kevin, 2026-10-24, point 6): two stories a week. BT1 is the opt-in email,
 * Thursday from 4pm where the person is; BT2 is the "New this week" notice in the family app, shown to
 * every grown-up until they close it. The two titles are picked in /admin/bedtime, or else Readli
 * takes the two newest books not featured before. Nothing about any child's listening goes in either.
 */

type Row = Record<string, unknown>;

/** BT1 is queued from this local hour on Thursday, while send hours still allow it. */
export const BEDTIME_HOUR = 16;
const LAST_HOUR = 19;

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

/** The local date (YYYY-MM-DD), weekday (0 = Sunday) and hour somewhere. */
export function localParts(at: Date, timeZone: string | null | undefined): { date: string; weekday: number; hour: number } {
  const tz = validTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "numeric", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday!), hour: Number(parts.hour) };
}

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** The Thursday that starts the Bedtime Thursdays week containing `at`, in New York. */
export function currentWeek(at: Date): string {
  const { date, weekday } = localParts(at, DEFAULT_TIME_ZONE);
  return addDays(date, -((weekday - 4 + 7) % 7));
}

export const nextWeek = (at: Date) => addDays(currentWeek(at), 7);

const readable = (slugs: unknown): CatalogBook[] | null => {
  if (!Array.isArray(slugs) || slugs.length !== 2) return null;
  const books = slugs.map((s) => findCatalogBook(String(s)));
  return books.every(Boolean) ? (books as CatalogBook[]) : null;
};

/** The week's two stories: the admin's pick, or the two newest not featured in an earlier week (then kept, so the week stays the same). */
export async function featuredBooks(db: SupabaseClient, weekOf: string): Promise<{ books: CatalogBook[]; chosen: boolean } | null> {
  const rows = await q(db.from("book_features").select("week_of, slugs, chosen_by").lte("week_of", weekOf), "read featured books");
  const mine = rows.find((r) => r.week_of === weekOf);
  const picked = mine ? readable(mine.slugs) : null;
  if (picked) return { books: picked, chosen: Boolean(mine!.chosen_by) };
  const before = new Set(rows.filter((r) => r.week_of !== weekOf).flatMap((r) => (Array.isArray(r.slugs) ? (r.slugs as string[]) : [])));
  const fresh = NEWEST_BOOKS.filter((b) => !before.has(b.slug));
  const books = (fresh.length >= 2 ? fresh : NEWEST_BOOKS).slice(0, 2);
  if (books.length < 2) return null;
  const at = new Date().toISOString();
  if (mine) await q(db.from("book_features").update({ slugs: books.map((b) => b.slug), chosen_by: null, updated_at: at }).eq("week_of", weekOf), "save featured books");
  else await q(db.from("book_features").upsert({ week_of: weekOf, slugs: books.map((b) => b.slug), chosen_by: null }, { onConflict: "week_of", ignoreDuplicates: true }), "save featured books");
  const saved = await q(db.from("book_features").select("slugs").eq("week_of", weekOf).limit(1), "read featured books");
  return { books: readable(saved[0]?.slugs) ?? books, chosen: false };
}

export class BedtimeError extends Error {}

/** /admin/bedtime: pick a week's two stories. */
export async function chooseFeaturedBooks(db: SupabaseClient, adminId: string, weekOf: string, slugs: string[], now = new Date()): Promise<CatalogBook[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf) || new Date(`${weekOf}T00:00:00Z`).getUTCDay() !== 4) throw new BedtimeError("Pick a Thursday.");
  if (weekOf < currentWeek(now)) throw new BedtimeError("That week has already gone out.");
  if (new Set(slugs).size !== 2) throw new BedtimeError("Pick two different stories.");
  const books = readable(slugs);
  if (!books) throw new BedtimeError("Pick two stories from the library.");
  await q(
    db.from("book_features").upsert({ week_of: weekOf, slugs, chosen_by: adminId, updated_at: now.toISOString() }, { onConflict: "week_of" }),
    "save featured books",
  );
  return books;
}

/** BT2: the week's notice for this grown-up, unless they closed it. */
export async function newThisWeek(db: SupabaseClient, userId: string, now = new Date()): Promise<{ weekOf: string; books: CatalogBook[] } | null> {
  const weekOf = currentWeek(now);
  const closed = await q(db.from("book_feature_dismissals").select("week_of").eq("user_id", userId).eq("week_of", weekOf).limit(1), "read dismissals");
  if (closed.length) return null;
  const featured = await featuredBooks(db, weekOf);
  return featured ? { weekOf, books: featured.books } : null;
}

export async function dismissNewThisWeek(db: SupabaseClient, userId: string, weekOf: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) return;
  const { error } = await db.from("book_feature_dismissals").insert({ user_id: userId, week_of: weekOf });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(`save dismissal: ${error.message}`);
}

function bedtimeMessage(base: string, books: CatalogBook[], to: { userId: string; preferences: string; headers: Record<string, string> } | { unsubscribe: string; headers: Record<string, string> }) {
  const member = "userId" in to;
  const link = (slug: string) => `${base}${member ? "/family/books" : "/books"}/${slug}`;
  return readliEmail({
    subject: `Bedtime Thursdays: ${books[0]!.title} and ${books[1]!.title}`,
    name: "",
    title: "Two stories for this week's bedtimes",
    paragraphs: [member ? "Here are this week's two stories. Pick one, and it's read in the voice your kids know best." : "Here are this week's two stories in the Readli library, read aloud in a voice your kids know."],
    books: books.map((b) => ({ title: b.title, byline: b.author, url: link(b.slug), imageUrl: b.coverUrl ? `${base}${b.coverUrl}` : null })),
    cta: { label: "See this week's stories", url: member ? `${base}/family/books` : `${base}/books` },
    reason: "You're getting this because you asked for Bedtime Thursdays and Readli news.",
    preferencesUrl: member ? to.preferences : to.unsubscribe,
    footerLabel: member ? "Unsubscribe or change your email settings" : "Unsubscribe",
    headers: to.headers,
  });
}

/** Queues BT1 for everyone who opted in and whose Thursday afternoon it is. One per person per week. */
export async function queueBedtimeThursdays(ctx: SequenceContext): Promise<number> {
  if (!ctx.enabled.has("BT1")) return 0;
  const base = ctx.base.replace(/\/$/, "");
  const due = (tz: string | null) => {
    const local = localParts(ctx.now, tz);
    return local.weekday === 4 && local.hour >= BEDTIME_HOUR && local.hour < LAST_HOUR ? local.date : null;
  };
  const featured = new Map<string, CatalogBook[] | null>();
  const booksFor = async (week: string) => {
    if (!featured.has(week)) featured.set(week, (await featuredBooks(ctx.db, week))?.books ?? null);
    return featured.get(week)!;
  };
  const emails: QueuedEmail[] = [];

  const members = await q(ctx.db.from("email_preferences").select("user_id, time_zone").eq("marketing", true), "read Bedtime Thursdays sign-ups");
  for (const m of members) {
    const userId = m.user_id as string;
    const week = due((m.time_zone as string | null) ?? null);
    const books = week ? await booksFor(week) : null;
    if (!week || !books) continue;
    emails.push({
      emailId: "BT1",
      dedupeKey: `BT1:${week}:${userId}`,
      to: { userId },
      message: bedtimeMessage(base, books, { userId, preferences: preferencesUrl(base, ctx.secret, userId), headers: unsubscribeHeaders(base, ctx.secret, userId, "marketing") }),
    });
  }

  // People without an account who asked for news when they emailed themselves a demo. Their time zone isn't known.
  const week = due(null);
  const books = week ? await booksFor(week) : null;
  if (week && books) {
    const contacts = await q(ctx.db.from("email_marketing_contacts").select("email_hash, email_encrypted").is("unsubscribed_at", null), "read news contacts");
    const cipher = new ProviderRefCipher(ctx.secret);
    for (const c of contacts) {
      let email: string;
      try {
        email = cipher.decrypt(c.email_encrypted as string);
      } catch {
        continue;
      }
      const hash = emailHash(ctx.secret, email);
      if (hash !== c.email_hash) continue;
      const unsubscribe = contactUnsubscribeUrl(base, ctx.secret, hash);
      emails.push({
        emailId: "BT1",
        dedupeKey: `BT1:${week}:c:${hash}`,
        to: { email },
        message: bedtimeMessage(base, books, { unsubscribe, headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
      });
    }
  }
  return (await queueEmails(ctx.db, ctx.secret, emails, ctx.now)).length;
}

/** The notice for a page, or null in preview mode, on a kids device, or if anything goes wrong. */
export async function newThisWeekFor(session: { account?: { id: string }; actor: { kind: string }; device?: unknown; temporary?: unknown } | null, db: SupabaseClient | null) {
  if (!db || !session?.account || session.actor.kind !== "adult" || session.device || session.temporary) return null;
  const notice = await newThisWeek(db, session.account.id).catch(() => null);
  return notice && { weekOf: notice.weekOf, books: notice.books.map((b) => ({ slug: b.slug, title: b.title, author: b.author, coverUrl: b.coverUrl })) };
}

import { findCatalogBook } from "@/lib/library/catalog";
import { narrationFor } from "@/lib/narration/narration";
import { bookText } from "@/lib/narration/text";
import { finished } from "./home";
import type { FamilyState } from "./model";
import { calledIn } from "./names";
import { activeChild } from "./permissions";
import { DEFAULT_PLAN, type PlanConfig } from "./plan";

/** How far back the notices page reaches: the family store reads notices from the last 31 days. */
export const INBOX_DAYS = 30;

/** One family notice, newest first, with the one thing to do about it. */
export interface InboxNotice {
  id: string;
  text: string;
  at: string;
  /** Not yet seen by this grown-up: newer than when they last cleared Home's notice. */
  unread: boolean;
  action: { label: string; href: string };
}

/** What a notice's button says and where it goes, from the link it was saved with. */
export function noticeAction(text: string, href: string): { label: string; href: string } {
  const book = /^\/family\/books\/([^/?#]+)$/.exec(href);
  if (book) {
    return / is (partly )?ready\.$/.test(text) ? { label: "Listen now", href: `${href}/listen` } : { label: "See the book", href };
  }
  if (href.startsWith("/family/narrators")) return { label: "Choose who they read to", href };
  return { label: "Open", href };
}

/**
 * Every notice for this household from the last month, newest first: readings that are ready or
 * failed, and storytellers whose voice is ready. Home shows a week of them in one line; this keeps
 * them all in one place, each with its button.
 */
export function familyInbox(state: FamilyState, householdId: string, adultId: string, now: Date = new Date()): InboxNotice[] {
  const since = new Date(now.getTime() - INBOX_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const seen = state.members.find((m) => m.householdId === householdId && m.adultId === adultId && m.removedAt === null)?.noticesSeenThrough ?? null;
  return state.notifications
    .filter((n) => n.householdId === householdId && n.at > since)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((n) => ({ id: n.id, text: n.text, at: n.at, unread: !seen || n.at > seen, action: noticeAction(n.text, n.href) }));
}

/** How many notices this grown-up hasn't seen yet. */
export function unreadCount(state: FamilyState, householdId: string, adultId: string, now: Date = new Date()): number {
  return familyInbox(state, householdId, adultId, now).filter((n) => n.unread).length;
}

/** One line of the family's reading story: a child finished a book, or is part way through it. */
export interface TimelineEntry {
  childId: string;
  childName: string;
  tint: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  /** Who read it to them, as this family calls them, when that voice is still known. */
  narrator: string | null;
  finished: boolean;
  percent: number;
  at: string;
}

/**
 * The family's reading together, newest first: for each child and book, the last time they listened
 * and whether they reached the end, and in whose voice. Built from each child's saved place, so a
 * book read again shows its latest listen.
 */
export function familyTimeline(state: FamilyState, householdId: string, plan: PlanConfig = DEFAULT_PLAN): TimelineEntry[] {
  const kids = state.children.filter((c) => c.householdId === householdId && activeChild(state, c.id));
  const entries: TimelineEntry[] = [];
  for (const p of state.progress) {
    const kid = kids.find((k) => k.id === p.childId);
    const book = findCatalogBook(p.bookSlug);
    const base = bookText(p.bookSlug);
    if (!kid || !book || !base || p.sentence <= 0) continue;
    const voice = p.voiceId ? state.voices.find((v) => v.id === p.voiceId && v.deletedAt === null) : undefined;
    // A place only counts as listening when it is in audio that exists; paging through text doesn't.
    const heard = voice ? narrationFor(state, plan, voice.id, base, householdId) : null;
    if (!heard || heard.status.ready === 0) continue;
    const text = heard.text ?? base;
    const done = finished(text.sentences, p.sentence);
    const owner = voice ? state.adults.find((a) => a.id === voice.ownerId) : undefined;
    entries.push({
      childId: kid.id,
      childName: kid.nickname,
      tint: kid.tint,
      slug: book.slug,
      title: book.title,
      coverUrl: book.coverUrl,
      narrator: owner ? (calledIn(state, owner, householdId)?.displayName ?? owner.displayName) : null,
      finished: done,
      percent: done ? 100 : Math.min(99, Math.round((p.sentence / Math.max(1, text.sentences.length)) * 100)),
      at: p.listenedAt ?? p.updatedAt,
    });
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

/** "Maya finished The Tale of Peter Rabbit with Grandpa." */
export function timelineLine(e: TimelineEntry): string {
  const who = e.narrator ? ` with ${e.narrator}` : "";
  return e.finished ? `${e.childName} finished ${e.title}${who}.` : `${e.childName} is ${e.percent}% through ${e.title}${who}.`;
}

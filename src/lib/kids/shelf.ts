import { CATALOG, type CatalogBook } from "@/lib/library/catalog";
import type { Actor, ChildBookProgress, FamilyState } from "@/lib/family/model";
import { narratorsFor, type FamilyStore, type NarratorView } from "@/lib/family/service";
import { THE_END } from "@/lib/content/the-end";
import { kidsReadiness } from "@/lib/narration/narration";
import { bookText } from "@/lib/narration/text";
import { isNewlyPrepared } from "@/lib/family/newest";

export interface ShelfBook {
  book: CatalogBook;
  /** Storytellers this child may hear who have the book prepared, at least from its first chapter. */
  voices: string[];
  favorite: boolean;
  /** When the newest of those audiobooks finished preparing. */
  preparedAt: string | null;
}

export interface KidsShelf {
  /** The story this child is part way through, if it is still ready for them and not finished. */
  resume: { book: CatalogBook; progress: ChildBookProgress; reader: NarratorView | undefined; total: number } | null;
  /** New stories: prepared in the last couple of weeks and not started yet, newest first. */
  newest: ShelfBook[];
  /** Ready to listen, favorites first (the page shows them in their own row), leaving out the stories already shown in Continue listening and New stories. */
  ready: ShelfBook[];
  /** Books not prepared for this child yet. */
  waiting: CatalogBook[];
}

/** At most one row of New stories on a wide screen. */
export const NEWEST_SHOWN = 5;

/** A saved place on the last sentence, or the one before a closing "The End.", means the child reached the end. */
export function reachedEnd(sentences: readonly { text: string }[], sentence: number): boolean {
  const last = sentences.at(-1)?.text === THE_END ? sentences.length - 2 : sentences.length - 1;
  return sentence >= last;
}

/**
 * One child's bookshelf, the same on every screen size. A book is ready when a storyteller this child
 * is approved to hear has it stored from the start: the whole book, or its first chapter when a grown-up
 * prepares a chapter at a time. Kids never prepare anything themselves.
 */
export async function kidsShelf(store: FamilyStore, actor: Actor, state: FamilyState, childId: string, now: number = Date.now()): Promise<KidsShelf> {
  const favorites = new Set(state.favorites.filter((f) => f.childId === childId).map((f) => f.bookSlug));
  const narrators = await narratorsFor(store, actor, childId);
  const nameOf = new Map(narrators.map((n) => [n.voiceId, n]));
  const books = await Promise.all(
    CATALOG.map(async (b) => {
      const readiness = await kidsReadiness(store, actor, childId, b.slug);
      const heard = readiness.filter((r) => r.listenable && nameOf.has(r.voiceId));
      const voices = heard.map((r) => nameOf.get(r.voiceId)!.name);
      const preparedAt = heard.reduce<string | null>((at, r) => (r.readyAt && (!at || r.readyAt > at) ? r.readyAt : at), null);
      return { book: b, voices, favorite: favorites.has(b.slug), preparedAt };
    }),
  );
  const allReady = books.filter((b) => b.voices.length > 0);
  const waiting = books.filter((b) => b.voices.length === 0).map((b) => b.book);
  const last = state.progress
    .filter((p) => {
      if (p.childId !== childId || p.sentence <= 0 || !allReady.some((b) => b.book.slug === p.bookSlug)) return false;
      const text = bookText(p.bookSlug);
      return Boolean(text) && !reachedEnd(text!.sentences, p.sentence);
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const resumeBook = last ? allReady.find((b) => b.book.slug === last.bookSlug)!.book : null;
  const resume =
    last && resumeBook
      ? { book: resumeBook, progress: last, reader: last.voiceId ? nameOf.get(last.voiceId) : undefined, total: bookText(resumeBook.slug)?.sentences.length ?? 1 }
      : null;
  // New stories, for the ones a grown-up just got ready: once the child starts one, it moves back to Ready to listen.
  const started = new Set(state.progress.filter((p) => p.childId === childId && p.sentence > 0).map((p) => p.bookSlug));
  const newest = allReady
    .filter((b) => b.book.slug !== resume?.book.slug && !started.has(b.book.slug) && isNewlyPrepared(b.preparedAt, now))
    .sort((a, b) => b.preparedAt!.localeCompare(a.preparedAt!))
    .slice(0, NEWEST_SHOWN);
  const shownNew = new Set(newest.map((b) => b.book.slug));
  const ready = allReady.filter((b) => b.book.slug !== resume?.book.slug && !shownNew.has(b.book.slug)).sort((a, b) => Number(b.favorite) - Number(a.favorite));
  return { resume, newest, ready, waiting };
}

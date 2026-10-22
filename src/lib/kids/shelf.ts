import { CATALOG, type CatalogBook } from "@/lib/library/catalog";
import type { Actor, ChildBookProgress, FamilyState } from "@/lib/family/model";
import { narratorsFor, type FamilyStore, type NarratorView } from "@/lib/family/service";
import { THE_END } from "@/lib/content/the-end";
import { kidsReadiness } from "@/lib/narration/narration";
import { bookText } from "@/lib/narration/text";

export interface ShelfBook {
  book: CatalogBook;
  /** Storytellers this child may hear who have the whole book prepared. */
  voices: string[];
  favorite: boolean;
}

export interface KidsShelf {
  /** The story this child is part way through, if it is still ready for them and not finished. */
  resume: { book: CatalogBook; progress: ChildBookProgress; reader: NarratorView | undefined; total: number } | null;
  /** Ready to listen, favorites first, leaving out the story already shown in Continue listening. */
  ready: ShelfBook[];
  /** Books not prepared for this child yet. */
  waiting: CatalogBook[];
}

/** A saved place on the last sentence, or the one before a closing "The End.", means the child reached the end. */
export function reachedEnd(sentences: readonly { text: string }[], sentence: number): boolean {
  const last = sentences.at(-1)?.text === THE_END ? sentences.length - 2 : sentences.length - 1;
  return sentence >= last;
}

/**
 * One child's bookshelf, the same on every screen size. A book is ready only when a storyteller this
 * child is approved to hear has every sentence stored; kids never prepare anything themselves.
 */
export async function kidsShelf(store: FamilyStore, actor: Actor, state: FamilyState, childId: string): Promise<KidsShelf> {
  const favorites = new Set(state.favorites.filter((f) => f.childId === childId).map((f) => f.bookSlug));
  const narrators = await narratorsFor(store, actor, childId);
  const nameOf = new Map(narrators.map((n) => [n.voiceId, n]));
  const books = await Promise.all(
    CATALOG.map(async (b) => {
      const readiness = await kidsReadiness(store, actor, childId, b.slug);
      const voices = readiness.filter((r) => r.readiness === "ready").map((r) => nameOf.get(r.voiceId)?.name).filter((n): n is string => Boolean(n));
      return { book: b, voices, favorite: favorites.has(b.slug) };
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
  const ready = allReady.filter((b) => b.book.slug !== resume?.book.slug).sort((a, b) => Number(b.favorite) - Number(a.favorite));
  return { resume, ready, waiting };
}

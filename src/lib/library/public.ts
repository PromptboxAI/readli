import { planConfig } from "@/lib/family/plan";
import { bookMinutes } from "@/lib/narration/narration";
import { bookCharacters, bookText } from "@/lib/narration/text";
import { CATALOG, UPCOMING_BOOKS, findCatalogBook } from "./catalog";

/** A book as anyone can see it on /books, with no account and nothing about any family. */
export interface PublicBook {
  slug: string;
  title: string;
  author: string;
  firstPublished: number | null;
  coverUrl: string | null;
  tint: string;
  minutes: number;
  /** Characters of narration, which is what credits pay for. Null for books not in the library yet. */
  characters: number | null;
  chapters: string[];
  comingSoon: boolean;
}

function catalogBook(slug: string): PublicBook | null {
  const b = findCatalogBook(slug);
  const text = bookText(slug);
  if (!b || !text) return null;
  return {
    slug: b.slug,
    title: b.title,
    author: b.author,
    firstPublished: b.firstPublished,
    coverUrl: b.coverUrl,
    tint: b.tint,
    minutes: bookMinutes(text, planConfig()),
    characters: bookCharacters(text),
    chapters: b.chapters.map((c) => c.title),
    comingSoon: false,
  };
}

/** The whole library: books ready to prepare, shortest first, then books coming soon. */
export function publicLibrary(): PublicBook[] {
  const ready = CATALOG.map((b) => catalogBook(b.slug)).filter((b): b is PublicBook => b !== null);
  ready.sort((a, b) => a.minutes - b.minutes);
  const soon = UPCOMING_BOOKS.map(
    (b): PublicBook => ({ ...b, tint: "bg-sunshine", minutes: b.approxMinutes, characters: null, chapters: [], comingSoon: true }),
  );
  return [...ready, ...soon];
}

export function publicBook(slug: string): PublicBook | null {
  return publicLibrary().find((b) => b.slug === slug) ?? null;
}

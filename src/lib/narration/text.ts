import { createHash } from "node:crypto";
import { findCatalogBook } from "@/lib/library/catalog";
import { sentencesOf } from "@/lib/content/sentences";

/**
 * Canonical book text with stable sentence ids. A sentence id names the book, the text revision
 * and the sentence's place, so narration in any voice lines up with the same highlighted text.
 */
export interface CanonicalSentence {
  id: string;
  ordinal: number;
  chapter: number;
  text: string;
}

export interface BookText {
  slug: string;
  title: string;
  edition: string;
  revision: string;
  sentences: CanonicalSentence[];
  chapters: { number: number; title: string; sentenceIds: string[] }[];
}

export function bookText(slug: string): BookText | null {
  const book = findCatalogBook(slug);
  if (!book) return null;
  const revision = createHash("sha256").update(book.chapters.map((c) => c.text).join("\n\n")).digest("hex").slice(0, 12);
  const sentences: CanonicalSentence[] = [];
  const chapters: BookText["chapters"] = [];
  book.chapters.forEach((c, i) => {
    const ids: string[] = [];
    for (const text of sentencesOf(c.text)) {
      const ordinal = sentences.length;
      const id = `${slug}.${revision}.${ordinal}`;
      sentences.push({ id, ordinal, chapter: i + 1, text });
      ids.push(id);
    }
    chapters.push({ number: i + 1, title: c.title, sentenceIds: ids });
  });
  return { slug, title: book.title, edition: book.edition, revision, sentences, chapters };
}

/** Characters of narration text in the whole book. */
export function bookCharacters(text: BookText): number {
  return text.sentences.reduce((n, s) => n + s.text.length, 0);
}

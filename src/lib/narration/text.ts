import { createHash } from "node:crypto";
import { findDemoBook } from "@/lib/content/demo-books";
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
  const book = findDemoBook(slug);
  if (!book?.passageText) return null;
  const revision = createHash("sha256").update(book.passageText).digest("hex").slice(0, 12);
  const sentences = sentencesOf(book.passageText).map((text, ordinal) => ({
    id: `${slug}.${revision}.${ordinal}`,
    ordinal,
    chapter: 1,
    text,
  }));
  return {
    slug,
    title: book.title,
    // Demo books carry one sample passage until the full library editions land (Phase 7).
    edition: book.gutenbergId ? `gutenberg-${book.gutenbergId}` : "readli-passage",
    revision,
    sentences,
    chapters: [{ number: 1, title: "Opening", sentenceIds: sentences.map((s) => s.id) }],
  };
}

import { findCatalogBook } from "./catalog";

/** Enough of the first chapter to get a feel for the story, without giving much of it away. */
const TARGET_CHARS = 240;
const MAX_PARAGRAPHS = 3;
/** A single paragraph longer than this is cut at a sentence end. */
const MAX_PARAGRAPH_CHARS = 420;

function trimParagraph(p: string): string {
  if (p.length <= MAX_PARAGRAPH_CHARS) return p;
  const head = p.slice(0, MAX_PARAGRAPH_CHARS);
  const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  return end > 0 ? `${head.slice(0, end + 1)}…` : `${head.slice(0, head.lastIndexOf(" "))}…`;
}

/**
 * The opening paragraphs of a book, word for word from the edition Readli narrates. Verse keeps its
 * line breaks, so show each paragraph with `white-space: pre-line`. Empty for a book without its text.
 */
export function bookOpening(slug: string): string[] {
  const first = findCatalogBook(slug)?.chapters[0]?.text;
  if (!first) return [];
  const paragraphs = first
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const opening: string[] = [];
  let length = 0;
  for (const p of paragraphs) {
    if (opening.length === MAX_PARAGRAPHS || (opening.length > 0 && length >= TARGET_CHARS)) break;
    const kept = trimParagraph(p);
    opening.push(kept);
    length += kept.length;
  }
  return opening;
}

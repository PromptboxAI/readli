/**
 * The six homepage demo books, locked by PRD F-05, Design Brief §6 and
 * Amendment 001 (acceptance test F-9). Do not add, remove or swap titles.
 *
 * Passage text and cover art stay unset until each edition passes rights
 * review and the excerpt is editorially approved (PRD §15 step 4).
 */

export type RightsStatus = "pending_review" | "approved" | "rejected";

export interface DemoBook {
  slug: string;
  title: string;
  author: string;
  firstPublished: number;
  /** Project Gutenberg eBook number for the specific edition we intend to use. */
  gutenbergId: number;
  /** True once a reviewer has confirmed the edition, not just the title. */
  editionConfirmed: boolean;
  editionNote?: string;
  rightsStatus: RightsStatus;
  /** Target length of the approved sample passage, in seconds (brief: <= 45s). */
  passageTargetSeconds: number;
  /** Approved excerpt; null until editorial approval. */
  passageText: string | null;
  /** Placeholder palette for the cover tile until rights-cleared art exists. */
  tile: { background: string; accent: string };
}

export const DEMO_BOOKS: readonly DemoBook[] = [
  {
    slug: "the-tale-of-peter-rabbit",
    title: "The Tale of Peter Rabbit",
    author: "Beatrix Potter",
    firstPublished: 1902,
    gutenbergId: 14838,
    editionConfirmed: false,
    rightsStatus: "pending_review",
    passageTargetSeconds: 40,
    passageText: null,
    tile: { background: "var(--color-mint)", accent: "var(--color-coral)" },
  },
  {
    slug: "the-tale-of-benjamin-bunny",
    title: "The Tale of Benjamin Bunny",
    author: "Beatrix Potter",
    firstPublished: 1904,
    gutenbergId: 14407,
    editionConfirmed: false,
    rightsStatus: "pending_review",
    passageTargetSeconds: 40,
    passageText: null,
    tile: { background: "var(--color-sunshine)", accent: "var(--color-navy)" },
  },
  {
    slug: "the-wonderful-wizard-of-oz",
    title: "The Wonderful Wizard of Oz",
    author: "L. Frank Baum",
    firstPublished: 1900,
    gutenbergId: 55,
    editionConfirmed: false,
    rightsStatus: "pending_review",
    passageTargetSeconds: 45,
    passageText: null,
    tile: { background: "var(--color-sky)", accent: "var(--color-sunshine)" },
  },
  {
    slug: "alices-adventures-in-wonderland",
    title: "Alice’s Adventures in Wonderland",
    author: "Lewis Carroll",
    firstPublished: 1865,
    gutenbergId: 11,
    editionConfirmed: false,
    rightsStatus: "pending_review",
    passageTargetSeconds: 45,
    passageText: null,
    tile: { background: "var(--color-lavender)", accent: "var(--color-coral)" },
  },
  {
    slug: "peter-pan-peter-and-wendy",
    title: "Peter Pan: Peter and Wendy",
    author: "J. M. Barrie",
    firstPublished: 1911,
    gutenbergId: 16,
    editionConfirmed: true,
    editionNote: "1911 novel, not later film adaptations.",
    rightsStatus: "pending_review",
    passageTargetSeconds: 45,
    passageText: null,
    tile: { background: "var(--color-coral)", accent: "var(--color-sky)" },
  },
  {
    slug: "winnie-the-pooh",
    title: "Winnie-the-Pooh",
    author: "A. A. Milne",
    firstPublished: 1926,
    gutenbergId: 67098,
    editionConfirmed: true,
    editionNote: "Original 1926 text, no Disney artwork or later additions.",
    rightsStatus: "pending_review",
    passageTargetSeconds: 45,
    passageText: null,
    tile: { background: "var(--color-sunshine)", accent: "var(--color-mint)" },
  },
];

export function gutenbergUrl(book: DemoBook): string {
  return `https://www.gutenberg.org/ebooks/${book.gutenbergId}`;
}

/** Audio is playable only once rights and the passage are approved. */
export function isPassagePlayable(book: DemoBook): boolean {
  return book.rightsStatus === "approved" && book.passageText !== null;
}

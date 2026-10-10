/**
 * The six homepage demo books.
 *
 * Originally locked by PRD F-05 / Design Brief §6 / Amendment 001 F-9. Kevin
 * replaced the selection on 2026-10-10 (see docs/decisions.md); that decision
 * supersedes the earlier lock. Order is deliberate (no two bunnies side by side).
 * Do not change titles or order without a new decision.
 *
 * Passage text stays unset until each edition passes rights review and the
 * excerpt is editorially approved (PRD §15 step 4). Covers are original
 * Readli artwork, never scans of historic editions.
 */

export type RightsStatus = "pending_review" | "approved" | "rejected";

export interface DemoBook {
  slug: string;
  title: string;
  author: string;
  firstPublished: number;
  /** Project Gutenberg eBook number for the candidate edition; null until chosen. */
  gutenbergId: number | null;
  /** True once a reviewer has confirmed the edition, not just the title. */
  editionConfirmed: boolean;
  editionNote?: string;
  rightsStatus: RightsStatus;
  /** Target length of the approved sample passage, in seconds (brief: <= 45s). */
  passageTargetSeconds: number;
  /** Approved excerpt; null until editorial approval. */
  passageText: string | null;
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
  },
  {
    slug: "the-lion-and-the-mouse",
    title: "The Lion and the Mouse",
    author: "Aesop",
    firstPublished: 1919,
    gutenbergId: null,
    editionConfirmed: false,
    editionNote: "Fable. Candidate text: The Aesop for Children (1919, illustrated by Milo Winter). Gutenberg ID to confirm.",
    rightsStatus: "pending_review",
    passageTargetSeconds: 30,
    passageText: null,
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
  },
  {
    slug: "the-three-little-pigs",
    title: "The Three Little Pigs",
    author: "Traditional, retold by L. Leslie Brooke",
    firstPublished: 1904,
    gutenbergId: null,
    editionConfirmed: false,
    editionNote: "Folk tale. Reference edition: L. Leslie Brooke, The Story of the Three Little Pigs (Warne, 1904). Source text to confirm.",
    rightsStatus: "pending_review",
    passageTargetSeconds: 40,
    passageText: null,
  },
  {
    slug: "the-princess-and-the-pea",
    title: "The Princess and the Pea",
    author: "Hans Christian Andersen",
    firstPublished: 1835,
    gutenbergId: null,
    editionConfirmed: false,
    editionNote: "Needs a public-domain English translation (not Hersholt, 1949). Dulac's 1911 illustrations are reference only.",
    rightsStatus: "pending_review",
    passageTargetSeconds: 40,
    passageText: null,
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
  },
];

/** Original Readli cover art (600x800 WebP in /public/covers). */
export function coverSrc(book: DemoBook): string {
  return `/covers/${book.slug}.webp`;
}

export function gutenbergUrl(book: DemoBook): string | null {
  return book.gutenbergId === null ? null : `https://www.gutenberg.org/ebooks/${book.gutenbergId}`;
}

/** Audio is playable only once rights and the passage are approved. */
export function isPassagePlayable(book: DemoBook): boolean {
  return book.rightsStatus === "approved" && book.passageText !== null;
}

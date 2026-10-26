import type { PublicBook } from "@/lib/library/public";

/**
 * Credits in bedtime terms (Kevin, 2026-10-24: "translate it"). A credit pays for a fixed number of
 * characters, and Readli reads about that many characters a minute, so one credit is roughly one
 * minute of new reading in one voice. These are estimates for public pages; the family library
 * still shows the exact cost before anything is prepared.
 */

/** Credits to prepare a whole book once, in one voice, rounded up the way a family would budget it. */
export function bookCredits(characters: number, charactersPerCredit: number): number {
  return Math.max(1, Math.ceil(characters / charactersPerCredit));
}

/** Books a bedtime can hold: the library's short stories, leaving out the chapter books. */
const PICTURE_BOOK_MAX_MINUTES = 30;

/** Credits for a typical picture book: the middle of the library's short stories. */
export function typicalStoryCredits(books: readonly PublicBook[], charactersPerCredit: number): number {
  const costs = books
    .filter((b) => !b.comingSoon && b.characters !== null && b.minutes <= PICTURE_BOOK_MAX_MINUTES)
    .map((b) => bookCredits(b.characters!, charactersPerCredit))
    .sort((a, b) => a - b);
  if (costs.length === 0) return 1;
  return costs[Math.floor(costs.length / 2)]!;
}

/** "About N bedtime stories a month": new picture books a month's credits prepare in one voice. */
export function storiesPerMonth(monthlyCredits: number, books: readonly PublicBook[], charactersPerCredit: number): number {
  return Math.max(1, Math.floor(monthlyCredits / typicalStoryCredits(books, charactersPerCredit)));
}

/** "about 7 months": how long a long book takes on the monthly credits alone, one chapter at a time. */
export function monthsOfCredits(credits: number, monthlyCredits: number): number {
  return Math.max(1, Math.ceil(credits / Math.max(1, monthlyCredits)));
}

/** Books shown in the pricing examples, short to long. Missing slugs are skipped. */
export const CREDIT_EXAMPLE_SLUGS = ["the-tale-of-peter-rabbit", "the-three-little-pigs", "the-velveteen-rabbit", "winnie-the-pooh", "heidi"] as const;

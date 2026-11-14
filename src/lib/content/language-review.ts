/**
 * Kevin's decisions on what the outdated-language scanner (./language-check.ts) finds in each book.
 * language-check.test.ts requires every book's findings to match its entry here term for term, so a
 * new book, or an edit that adds a flagged word, fails until someone reviews it and records it here.
 *
 * Kevin, 2026-10-22: every word the first full scan found was replaced (Cinder-slut, Cock Robin,
 * Tom Tits-mouse, Cheshire Puss, Hottentots, "lame" Clara, queer, gay and the rest), so no book
 * keeps a flagged word today. Record a word here only when Kevin decides to keep it.
 */
export type LanguageDecision = "kept";

export const LANGUAGE_REVIEW: Record<string, Record<string, { count: number; decision: LanguageDecision }>> = {};

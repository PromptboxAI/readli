/**
 * Kevin's decisions on what the outdated-language scanner (./language-check.ts) found in each book.
 * language-check.test.ts requires every book's findings to match its entry here term for term, so a
 * new book, or an edit that adds a flagged word, fails until someone reviews it and records it here.
 *
 * "pending": found by the first full scan (2026-10-22), awaiting Kevin's decision; no text changed yet.
 * "kept": Kevin read the passages and is happy with the old wording.
 * When a word is replaced, lower its count (or drop the entry) in the same change as the text edit.
 */
export type LanguageDecision = "pending" | "kept";

export const LANGUAGE_REVIEW: Record<string, Record<string, { count: number; decision: LanguageDecision }>> = {
  "a-childs-garden-of-verses": {
    indian: { count: 1, decision: "pending" },
  },
  "alices-adventures-in-wonderland": {
    pussy: { count: 1, decision: "pending" },
    queer: { count: 13, decision: "pending" },
    savage: { count: 4, decision: "pending" },
    idiot: { count: 2, decision: "pending" },
    gay: { count: 1, decision: "pending" },
  },
  "cinderella": {
    slut: { count: 3, decision: "pending" },
  },
  "heidi": {
    hottentot: { count: 2, decision: "pending" },
    heathen: { count: 1, decision: "pending" },
    indian: { count: 1, decision: "pending" },
    lame: { count: 5, decision: "pending" },
    dumb: { count: 1, decision: "pending" },
    queer: { count: 1, decision: "pending" },
    gay: { count: 1, decision: "pending" },
    chink: { count: 2, decision: "pending" },
  },
  "just-so-stories": {
    oriental: { count: 3, decision: "pending" },
    slave: { count: 1, decision: "pending" },
    idiot: { count: 1, decision: "pending" },
    indian: { count: 1, decision: "pending" },
    queer: { count: 1, decision: "pending" },
    gay: { count: 1, decision: "pending" },
  },
  "raggedy-ann-stories": {
    queer: { count: 7, decision: "pending" },
    chink: { count: 1, decision: "pending" },
  },
  "the-emperors-new-clothes": {
    gay: { count: 1, decision: "pending" },
    queer: { count: 1, decision: "pending" },
  },
  "the-tale-of-mrs-tiggy-winkle": {
    cock: { count: 3, decision: "pending" },
    dick: { count: 1, decision: "pending" },
    tits: { count: 1, decision: "pending" },
  },
  "the-ugly-duckling": {
    cock: { count: 2, decision: "pending" },
    queer: { count: 1, decision: "pending" },
  },
  "the-velveteen-rabbit": {
    queer: { count: 1, decision: "pending" },
  },
  "thumbelina": {
    gay: { count: 1, decision: "pending" },
  },
};

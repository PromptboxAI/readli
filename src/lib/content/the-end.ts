/**
 * Every story closes with "The End." as its own final sentence (Kevin, 2026-10-15), narrated after a
 * short pause so it lands as its own paragraph rather than running on from the last line. Spanish
 * stories close with "Fin." instead (Spanish story shelf, 2026-11).
 */
export const THE_END = "The End.";
export const THE_END_ES = "Fin.";

export type StoryLanguage = "en" | "es";

/** The closing sentence a story in this language gets. */
export function closingFor(language: StoryLanguage = "en"): string {
  return language === "es" ? THE_END_ES : THE_END;
}

/** True for the exact closing sentence Readli adds, in any story language. */
export function isClosingSentence(text: string | undefined): boolean {
  return text === THE_END || text === THE_END_ES;
}

/** Silence before "The End." is read (halved from 1,200 ms, Kevin, 2026-10-21). */
export const THE_END_PAUSE_MS = 600;

/** True for a story's closing "The End." sentence: the last one, matching THE_END (or "Fin."). */
export function isTheEnd(sentences: readonly string[], at: number): boolean {
  return at === sentences.length - 1 && isClosingSentence(sentences[at]);
}

/** True when a sentence is already a closing "The End" (or "Fin"), in any case or punctuation. */
export function saysTheEnd(sentence: string): boolean {
  const words = sentence.replace(/[^\p{L} ]/gu, "").trim().toLowerCase();
  return words === "the end" || words === "fin";
}

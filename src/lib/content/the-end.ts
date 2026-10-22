/**
 * Every story closes with "The End." as its own final sentence (Kevin, 2026-10-15), narrated after a
 * short pause so it lands as its own paragraph rather than running on from the last line.
 */
export const THE_END = "The End.";

/** Silence before "The End." is read (halved from 1,200 ms, Kevin, 2026-10-21). */
export const THE_END_PAUSE_MS = 600;

/** True for a story's closing "The End." sentence: the last one, matching THE_END. */
export function isTheEnd(sentences: readonly string[], at: number): boolean {
  return at === sentences.length - 1 && sentences[at] === THE_END;
}

/** True when a sentence is already a closing "The End", in any case or punctuation. */
export function saysTheEnd(sentence: string): boolean {
  return sentence.replace(/[^a-z ]/gi, "").trim().toLowerCase() === "the end";
}

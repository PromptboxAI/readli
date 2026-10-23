/**
 * Narration scanner (Kevin, 2026-10-23). The voice model reads text literally: in The Three Billy
 * Goats Gruff it took "said the billy-goat, with such a small voice" as a direction and read the line
 * too quietly to hear, and the capitalised "TRIP, TRAP!" fragments became tiny clips of their own.
 * This flags the same patterns in any book, so they are rewritten before the book is narrated:
 * narration-check.test.ts fails on any finding a book's entry in NARRATION_REVIEW doesn't account
 * for, and `node scripts/language-scan.mjs` prints each one for a book being imported.
 *
 * Self-contained (no imports) so the script can load it with Node's type stripping.
 */

export type NarrationIssue = "shouting" | "quiet-cue" | "repeated-fragment" | "symbols";

export const NARRATION_ADVICE: Record<NarrationIssue, string> = {
  shouting: "Words in capitals may be shouted or spelled out letter by letter; write them in normal case.",
  "quiet-cue": "A cue to speak quietly can make the narrator too soft to hear; leave it out or use a verb like 'cried'.",
  "repeated-fragment": "A one- or two-word sound repeated as its own sentence becomes separate tiny clips; join them into one line ('Caw, caw!').",
  symbols: "Runs of punctuation or symbols are read oddly; keep a single ! or ?.",
};

export interface NarrationFinding {
  issue: NarrationIssue;
  chapter: number;
  chapterTitle: string;
  /** The sentence as the player splits it. */
  sentence: string;
}

// The same split as sentencesOf in ./sentences.ts, which the player uses.
const sentencesOf = (text: string) =>
  text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St)\.)(?<=[.!?][”"’]?)\s+(?=[“"A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);

const CAPS = /\b[A-Z][A-Z'’-]*[A-Z]\b/g;
const ROMAN = /^[IVXLC]+$/;
const QUIET =
  /\b(?:in|with) (?:a |such a |his |her |their )?(?:very )?(?:small|little|tiny|low|faint|soft|weak|squeaky|wee)(?:,? [a-z-]+)? (?:voices?|tones?)\b|\bin a whisper\b/i;
const letters = (s: string) => s.toLowerCase().replace(/[^\p{L}]/gu, "");
const wordCount = (s: string) => (s.match(/[\p{L}'’-]+/gu) ?? []).length;

/** Every sentence in a book's chapters that the narration model is likely to misread, in reading order. */
export function scanNarration(chapters: readonly { title: string; text: string }[]): NarrationFinding[] {
  const findings: NarrationFinding[] = [];
  chapters.forEach((c, i) => {
    const sentences = sentencesOf(c.text);
    sentences.forEach((s, j) => {
      const flag = (issue: NarrationIssue) => findings.push({ issue, chapter: i + 1, chapterTitle: c.title, sentence: s.replace(/\s+/g, " ") });
      if ((s.match(CAPS) ?? []).some((w) => !ROMAN.test(w))) flag("shouting");
      if (QUIET.test(s)) flag("quiet-cue");
      const same = [sentences[j - 1], sentences[j + 1]].some((n) => n !== undefined && letters(n) === letters(s));
      if (wordCount(s) <= 2 && same) flag("repeated-fragment");
      if (/[!?*]{3,}/.test(s)) flag("symbols");
    });
  });
  return findings;
}

/** How many sentences each issue is found in, for comparing a book against its review. */
export function countByIssue(findings: readonly NarrationFinding[]): Partial<Record<NarrationIssue, number>> {
  const counts: Partial<Record<NarrationIssue, number>> = {};
  for (const f of findings) counts[f.issue] = (counts[f.issue] ?? 0) + 1;
  return counts;
}

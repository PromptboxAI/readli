/** How many sentences make one "page" in the Readli player. Arrows still step one sentence at a time. */
export const SENTENCES_PER_PAGE = 4;

/** More pages than this and the progress pills become one continuous bar. */
export const MAX_PILLS = 20;

export function pageCount(sentences: number): number {
  return Math.max(1, Math.ceil(sentences / SENTENCES_PER_PAGE));
}

/** The zero-based page holding a sentence. */
export function pageOf(sentence: number): number {
  return Math.floor(Math.max(0, sentence) / SENTENCES_PER_PAGE);
}

/** The first and one-past-last sentence on a page. */
export function pageRange(page: number, sentences: number): [number, number] {
  const start = page * SENTENCES_PER_PAGE;
  return [start, Math.min(sentences, start + SENTENCES_PER_PAGE)];
}

/** The sleep timer cycles off, 15, 30, 45 minutes and back to off. */
export const SLEEP_STEPS = [null, 15, 30, 45] as const;
export type SleepMinutes = (typeof SLEEP_STEPS)[number];

export function nextSleep(current: SleepMinutes): SleepMinutes {
  return SLEEP_STEPS[(SLEEP_STEPS.indexOf(current) + 1) % SLEEP_STEPS.length]!;
}

export type PlayerMode = "listen" | "read";

/** The player's two modes; anything unknown falls back to Listen, the default. */
export function parseMode(value: string | null | undefined): PlayerMode {
  return value === "read" ? "read" : "listen";
}

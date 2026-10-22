/** How many sentences make one "page" in the Readli player. Arrows still step one sentence at a time. */
export const SENTENCES_PER_PAGE = 4;

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

/** Where each sentence starts on the time bar, in seconds, plus the story's total length last. */
export function timeline(seconds: number[]): number[] {
  const starts = [0];
  for (const s of seconds) starts.push(starts[starts.length - 1]! + Math.max(0, s));
  return starts;
}

/** The sentence playing at a point on the time bar. */
export function sentenceAt(starts: number[], at: number): number {
  const last = Math.max(0, starts.length - 2);
  let i = 0;
  while (i < last && starts[i + 1]! <= at) i++;
  return i;
}

/** 0:24, 3:05 or 1:02:09. */
export function clock(seconds: number): string {
  const t = Math.max(0, Math.round(seconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

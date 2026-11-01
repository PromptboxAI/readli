/**
 * How many sentences make one "page" in the Readli player, kept short so a page fits a phone screen
 * without scrolling. Arrows still step one sentence at a time.
 */
export const SENTENCES_PER_PAGE = 2;

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

/**
 * The sleep timer cycles off, 15, 30, 45 minutes, then "end of chapter" (only in books with more than
 * one chapter, since a one-chapter story simply ends) and back to off.
 */
export const SLEEP_STEPS = [null, 15, 30, 45, "chapter"] as const;
export type SleepMinutes = (typeof SLEEP_STEPS)[number];

export function nextSleep(current: SleepMinutes, chapters = false): SleepMinutes {
  const steps: readonly SleepMinutes[] = chapters ? SLEEP_STEPS : SLEEP_STEPS.filter((s) => s !== "chapter");
  return steps[(steps.indexOf(current) + 1) % steps.length] ?? null;
}

/** True when sentence `at` is the last one of its chapter (or of the book), where "end of chapter" stops. */
export function endsChapter(chapters: readonly number[], at: number): boolean {
  return at + 1 >= chapters.length || chapters[at + 1] !== chapters[at];
}

/** Playback speeds a grown-up can pick, cycled in this order from normal. */
export const SPEEDS = [1, 1.2, 0.8] as const;
export type Speed = (typeof SPEEDS)[number];

export function nextSpeed(current: number): Speed {
  const i = SPEEDS.indexOf(current as Speed);
  return SPEEDS[(i + 1) % SPEEDS.length]!;
}

/** A remembered speed, or normal for anything unknown. */
export function parseSpeed(value: string | null | undefined): Speed {
  return SPEEDS.find((s) => String(s) === value) ?? 1;
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

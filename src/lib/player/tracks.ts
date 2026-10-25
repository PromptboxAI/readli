/**
 * Chapter tracks in the players: a fully prepared chapter plays as one continuous recording, and the
 * sentence on screen follows the recording's clock using the track's timing map. Safe for the browser.
 */

/** A chapter track as the server grants it (see authorizeChapterTrack). */
export interface Track {
  url: string;
  expiresAt: string;
  chapter: number;
  revision: string;
  contentType: string;
  durationMs: number;
  sentences: { index: number; startMs: number; durationMs: number }[];
}

/** The sentence being heard `ms` into a track: the last one that has started. */
export function sentenceAtTime(track: Pick<Track, "sentences">, ms: number): number {
  const s = track.sentences;
  let lo = 0;
  let hi = s.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s[mid]!.startMs <= ms) lo = mid;
    else hi = mid - 1;
  }
  return s[lo]?.index ?? 0;
}

/** Where a sentence starts in a track, in milliseconds, or null when the track doesn't hold it. */
export function startOf(track: Pick<Track, "sentences">, index: number): number | null {
  return track.sentences.find((s) => s.index === index)?.startMs ?? null;
}

/** True when every sentence of the chapter holding sentence `at` has audio, so it can play as one track. */
export function chapterReady(text: { sentenceIds: string[]; chapters: number[] }, ready: readonly string[], at: number): boolean {
  const chapter = text.chapters[at];
  if (chapter === undefined) return false;
  const have = new Set(ready);
  return text.chapters.every((c, i) => c !== chapter || have.has(text.sentenceIds[i]!));
}

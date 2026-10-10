/** Teleprompter scroll math, kept pure so it can be unit tested. */

export const MIN_WPM = 80;
export const MAX_WPM = 200;
export const WPM_STEP = 10;
export const DEFAULT_WPM = 140;

export const FONT_SIZES = [22, 26, 32, 40, 48] as const;
export const DEFAULT_FONT_INDEX = 2;

/** Fraction of the viewport height where the reader's eyes should rest. */
export const READING_LINE = 0.35;

export function clampWpm(wpm: number): number {
  return Math.min(MAX_WPM, Math.max(MIN_WPM, Math.round(wpm / WPM_STEP) * WPM_STEP));
}

/**
 * Pixels to advance for one animation frame.
 * `pxPerWord` is the script's rendered height divided by its word count, so the
 * scroll keeps pace with words regardless of font size or screen width.
 */
export function scrollDelta(wpm: number, pxPerWord: number, deltaMs: number): number {
  if (deltaMs <= 0 || pxPerWord <= 0) return 0;
  // Cap long frames (tab was hidden) so text never jumps ahead.
  const dt = Math.min(deltaMs, 100);
  return (wpm / 60_000) * pxPerWord * dt;
}

/** A paragraph's box within the script: offset from the top of the text and rendered height. */
export interface TextBlock {
  top: number;
  height: number;
}

/** Total height of the text itself, leaving out the gaps between paragraphs. */
export function textHeight(blocks: readonly TextBlock[]): number {
  return blocks.reduce((n, b) => n + b.height, 0);
}

/**
 * Maps a position measured along the text only (gaps removed) to a scroll offset.
 * Auto-scroll advances in text pixels, so when one paragraph ends the reading
 * line lands straight on the next one instead of crawling through the gap.
 */
export function textToScroll(blocks: readonly TextBlock[], position: number): number {
  let before = 0;
  for (const b of blocks) {
    if (position <= before + b.height) return b.top + Math.max(0, position - before);
    before += b.height;
  }
  const last = blocks[blocks.length - 1];
  return last ? last.top + last.height + (position - before) : position;
}

/** Inverse of textToScroll. An offset inside a gap counts as the start of the next paragraph. */
export function scrollToText(blocks: readonly TextBlock[], scrollTop: number): number {
  let before = 0;
  for (const b of blocks) {
    if (scrollTop < b.top) return before;
    if (scrollTop <= b.top + b.height) return before + (scrollTop - b.top);
    before += b.height;
  }
  const last = blocks[blocks.length - 1];
  return last ? before + Math.max(0, scrollTop - (last.top + last.height)) : scrollTop;
}

/** Remaining suggested reading time for words below the reading line. */
export function remainingSeconds(wordsRemaining: number, wpm: number): number {
  if (wpm <= 0) return 0;
  return Math.max(0, Math.round((wordsRemaining / wpm) * 60));
}

/**
 * Index of the sentence crossing the reading line.
 * `tops` are sentence offsets within the scroll content, ascending.
 */
export function activeIndex(tops: readonly number[], scrollTop: number, viewportHeight: number): number {
  const line = scrollTop + viewportHeight * READING_LINE;
  let index = 0;
  for (let i = 0; i < tops.length; i++) {
    const top = tops[i];
    if (top === undefined || top > line) break;
    index = i;
  }
  return index;
}

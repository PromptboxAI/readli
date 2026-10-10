/**
 * Advisory client-side audio quality checks (Amendment 001 §A).
 * The server repeats duration/codec/silence/size checks and is authoritative.
 *
 * Input is a stream of per-frame peak levels in [0, 1] sampled from an
 * AnalyserNode, plus how long each frame lasted.
 */

export const SILENCE_LEVEL = 0.02;
export const SPEECH_LEVEL = 0.06;
export const CLIP_LEVEL = 0.98;
export const MIN_SPEECH_MS = 45_000;

export interface LevelStats {
  totalMs: number;
  speechMs: number;
  silentMs: number;
  clippedMs: number;
  /** Median level of quiet frames: a rough background-noise floor. */
  noiseFloor: number;
}

export type QcIssue = "silent" | "too_short" | "too_quiet" | "clipping" | "noisy";

export interface QcResult {
  ok: boolean;
  issues: QcIssue[];
  speechMs: number;
}

export function createLevelTracker() {
  let totalMs = 0;
  let speechMs = 0;
  let silentMs = 0;
  let clippedMs = 0;
  const quiet: number[] = [];

  return {
    push(level: number, frameMs: number) {
      totalMs += frameMs;
      if (level >= CLIP_LEVEL) clippedMs += frameMs;
      if (level >= SPEECH_LEVEL) speechMs += frameMs;
      else if (level < SILENCE_LEVEL) silentMs += frameMs;
      if (level < SPEECH_LEVEL && quiet.length < 20_000) quiet.push(level);
    },
    stats(): LevelStats {
      const sorted = [...quiet].sort((a, b) => a - b);
      const noiseFloor = sorted.length ? (sorted[Math.floor(sorted.length / 2)] ?? 0) : 0;
      return { totalMs, speechMs, silentMs, clippedMs, noiseFloor };
    },
  };
}

export function evaluateLevels(stats: LevelStats): QcResult {
  const issues: QcIssue[] = [];
  if (stats.totalMs > 0 && stats.speechMs < 1_000) {
    issues.push("silent");
  } else {
    if (stats.speechMs < MIN_SPEECH_MS) issues.push("too_short");
    if (stats.totalMs > 0 && stats.speechMs / stats.totalMs < 0.25) issues.push("too_quiet");
  }
  if (stats.clippedMs > 1_500) issues.push("clipping");
  if (stats.noiseFloor > 0.045) issues.push("noisy");
  return { ok: issues.length === 0, issues, speechMs: stats.speechMs };
}

export const QC_MESSAGES: Record<QcIssue, string> = {
  silent: "We couldn't hear any speech. Check the right microphone is selected and try again.",
  too_short: "There's less than about 45 seconds of speech. A little more reading gives a better match.",
  too_quiet: "Your voice was quiet for most of the take. Try moving closer to the microphone.",
  clipping: "Some parts were too loud and distorted. Try moving a little further from the microphone.",
  noisy: "There's a lot of background noise. A quieter room will give a cleaner voice.",
};

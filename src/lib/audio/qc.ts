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
/** Below this much speech a take can't make a good voice. Browser tests lower it for the fake microphone's beeps. */
export const MIN_SPEECH_MS = Number(process.env.NEXT_PUBLIC_MIN_SPEECH_MS ?? 45_000);
/** A silent stretch longer than this (while recording) usually means the reader lost their place or stepped away. */
export const LONG_PAUSE_MS = 10_000;

export interface LevelStats {
  totalMs: number;
  speechMs: number;
  silentMs: number;
  clippedMs: number;
  /** Longest run of silence, in milliseconds. */
  longestSilenceMs: number;
  /** Median level of quiet frames: a rough background-noise floor. */
  noiseFloor: number;
}

export type QcIssue = "silent" | "too_short" | "too_quiet" | "clipping" | "noisy" | "long_pause";

/** Issues that make a take unusable: the reader has to record again before cloning. The rest are warnings. */
export const BLOCKING_QC_ISSUES: readonly QcIssue[] = ["silent", "too_short"];

export function blockingIssues(qc: { issues: readonly QcIssue[] }): QcIssue[] {
  return qc.issues.filter((i) => BLOCKING_QC_ISSUES.includes(i));
}

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
  let silenceRunMs = 0;
  let longestSilenceMs = 0;
  const quiet: number[] = [];

  return {
    push(level: number, frameMs: number) {
      totalMs += frameMs;
      if (level >= CLIP_LEVEL) clippedMs += frameMs;
      if (level >= SPEECH_LEVEL) speechMs += frameMs;
      else if (level < SILENCE_LEVEL) silentMs += frameMs;
      silenceRunMs = level < SILENCE_LEVEL ? silenceRunMs + frameMs : 0;
      longestSilenceMs = Math.max(longestSilenceMs, silenceRunMs);
      if (level < SPEECH_LEVEL && quiet.length < 20_000) quiet.push(level);
    },
    stats(): LevelStats {
      const sorted = [...quiet].sort((a, b) => a - b);
      const noiseFloor = sorted.length ? (sorted[Math.floor(sorted.length / 2)] ?? 0) : 0;
      return { totalMs, speechMs, silentMs, clippedMs, longestSilenceMs, noiseFloor };
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
  if (!issues.includes("silent") && (stats.longestSilenceMs ?? 0) > LONG_PAUSE_MS) issues.push("long_pause");
  return { ok: issues.length === 0, issues, speechMs: stats.speechMs };
}

export const QC_MESSAGES: Record<QcIssue, string> = {
  silent: "We couldn't hear any speech. Check the right microphone is selected, then record again.",
  too_short: "We heard less than about 45 seconds of your voice. Please read the whole story aloud and record again.",
  too_quiet: "Your voice was quiet for most of the take. Try moving a little closer to the microphone.",
  clipping: "Some parts were so loud they distorted. Try moving a little further from the microphone, or speak a touch softer.",
  noisy: "We heard a lot of background noise. A quieter room, away from fans and TVs, gives a cleaner voice.",
  long_pause: "There was a long silent stretch. Short pauses are good, but long gaps can make your voice sound hesitant.",
};

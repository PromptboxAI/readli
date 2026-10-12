/**
 * Recording session state for the continuous teleprompter (Amendment 001 §A).
 *
 * Pure reducer so it can be shared by the Phase 1 mock and the real
 * MediaRecorder capture in Phase 2. Scrolling is deliberately NOT part of this
 * state: speed, font size and position are independent of capture (F-3).
 */

export type RecorderStatus = "consent" | "ready" | "recording" | "paused" | "review";

export interface ConsentState {
  adultOwner: boolean;
  processing: boolean;
}

export interface RecorderState {
  status: RecorderStatus;
  consent: ConsentState;
  /** Milliseconds actually spent recording (pauses excluded). */
  elapsedMs: number;
  pauseCount: number;
  /** Increments on every Start over so the reader can reset its scroll. */
  take: number;
  /** Furthest script sentence reached while recording, and how many sentences the script has. */
  furthestSentence: number;
  totalSentences: number;
  /** The sentence that unlocks Finish: the first one of the script's last paragraph. */
  finishFromSentence: number;
}

export type RecorderAction =
  | { type: "set_consent"; field: keyof ConsentState; value: boolean }
  | { type: "accept_consent" }
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "tick"; deltaMs: number }
  | { type: "progress"; sentence: number; totalSentences: number; finishFromSentence?: number }
  | { type: "finish" }
  | { type: "start_over" };

export const TARGET_MIN_MS = 60_000;
export const TARGET_MAX_MS = 120_000;
/**
 * The take must reach the end of the script; this floor only stops a reader from dragging the
 * script to the end. Fast readers finish the whole script in about 70 seconds at 200 words/min.
 */
export const MIN_FINISH_MS = 50_000;

export const initialRecorderState: RecorderState = {
  status: "consent",
  consent: { adultOwner: false, processing: false },
  elapsedMs: 0,
  pauseCount: 0,
  take: 0,
  furthestSentence: 0,
  totalSentences: 0,
  finishFromSentence: 0,
};

export function hasConsent(consent: ConsentState): boolean {
  return consent.adultOwner && consent.processing;
}

export function recorderReducer(state: RecorderState, action: RecorderAction): RecorderState {
  switch (action.type) {
    case "set_consent":
      if (state.status !== "consent") return state;
      return { ...state, consent: { ...state.consent, [action.field]: action.value } };
    case "accept_consent":
      // Recording is blocked until both declarations are ticked (F-4).
      return state.status === "consent" && hasConsent(state.consent) ? { ...state, status: "ready" } : state;
    case "start":
      return state.status === "ready" ? { ...state, status: "recording" } : state;
    case "pause":
      return state.status === "recording" ? { ...state, status: "paused", pauseCount: state.pauseCount + 1 } : state;
    case "resume":
      return state.status === "paused" ? { ...state, status: "recording" } : state;
    case "tick": {
      if (state.status !== "recording") return state;
      return { ...state, elapsedMs: state.elapsedMs + Math.max(0, action.deltaMs) };
    }
    case "progress": {
      const finishFromSentence = Math.min(action.finishFromSentence ?? action.totalSentences - 1, action.totalSentences - 1);
      // Scrolling before Start, or after Finish, doesn't count as reading.
      if (state.status !== "recording" && state.status !== "paused") return { ...state, totalSentences: action.totalSentences, finishFromSentence };
      return {
        ...state,
        totalSentences: action.totalSentences,
        finishFromSentence,
        furthestSentence: Math.max(state.furthestSentence, Math.min(action.sentence, action.totalSentences - 1)),
      };
    }
    case "finish":
      return (state.status === "recording" || state.status === "paused") && canFinish(state) ? { ...state, status: "review" } : state;
    case "start_over":
      if (state.status === "consent") return state;
      return { ...state, status: "ready", elapsedMs: 0, pauseCount: 0, take: state.take + 1, furthestSentence: 0 };
  }
}

export type FinishBlocker = "script" | "time" | null;

/**
 * Why Finish is still locked: the reader hasn't reached the last paragraph yet, or the take is
 * shorter than the floor. Finish turns on as the last paragraph starts, so a reader who gets there
 * ahead of the scroll never waits in silence (Kevin, 2026-10-12).
 */
type FinishFacts = Pick<RecorderState, "elapsedMs" | "furthestSentence" | "totalSentences" | "finishFromSentence">;

export function finishBlocker(state: FinishFacts): FinishBlocker {
  if (state.totalSentences > 0 && state.furthestSentence < state.finishFromSentence) return "script";
  if (state.elapsedMs < MIN_FINISH_MS) return "time";
  return null;
}

export function canFinish(state: FinishFacts): boolean {
  return finishBlocker(state) === null;
}

export type DurationGuidance = "too_short" | "in_range" | "long";

export function durationGuidance(elapsedMs: number): DurationGuidance {
  if (elapsedMs < TARGET_MIN_MS) return "too_short";
  if (elapsedMs <= TARGET_MAX_MS) return "in_range";
  return "long";
}

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
}

export type RecorderAction =
  | { type: "set_consent"; field: keyof ConsentState; value: boolean }
  | { type: "accept_consent" }
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "tick"; deltaMs: number }
  | { type: "finish" }
  | { type: "start_over" };

export const TARGET_MIN_MS = 60_000;
export const TARGET_MAX_MS = 120_000;

export const initialRecorderState: RecorderState = {
  status: "consent",
  consent: { adultOwner: false, processing: false },
  elapsedMs: 0,
  pauseCount: 0,
  take: 0,
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
    case "tick":
      return state.status === "recording" ? { ...state, elapsedMs: state.elapsedMs + Math.max(0, action.deltaMs) } : state;
    case "finish":
      return (state.status === "recording" || state.status === "paused") && canFinish(state.elapsedMs)
        ? { ...state, status: "review" }
        : state;
    case "start_over":
      if (state.status === "consent") return state;
      return { ...state, status: "ready", elapsedMs: 0, pauseCount: 0, take: state.take + 1 };
  }
}

/** A take can't be finished before the one-minute minimum; shorter samples make poor clones. */
export function canFinish(elapsedMs: number): boolean {
  return elapsedMs >= TARGET_MIN_MS;
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

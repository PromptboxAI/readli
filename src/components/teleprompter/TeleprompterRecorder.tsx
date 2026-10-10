"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { DemoBookShelf } from "@/components/books/DemoBookShelf";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import type { VoiceScriptVersion } from "@/lib/content/voice-scripts";
import {
  durationGuidance,
  formatClock,
  initialRecorderState,
  recorderReducer,
  TARGET_MAX_MS,
  TARGET_MIN_MS,
} from "@/lib/teleprompter/recorder-machine";
import { clampWpm, DEFAULT_FONT_INDEX, DEFAULT_WPM, FONT_SIZES, WPM_STEP } from "@/lib/teleprompter/scroll";
import { Teleprompter, type TeleprompterProgress } from "./Teleprompter";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const STATUS_LABEL = {
  consent: "Not recording",
  ready: "Ready to record",
  recording: "Recording",
  paused: "Paused",
  review: "Take finished",
} as const;

export function TeleprompterRecorder({ script }: { script: VoiceScriptVersion }) {
  const [state, dispatch] = useReducer(recorderReducer, initialRecorderState);
  const reducedMotion = usePrefersReducedMotion();
  const [autoScrollOn, setAutoScrollOn] = useState(true);
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [fontIndex, setFontIndex] = useState(DEFAULT_FONT_INDEX);
  const [progress, setProgress] = useState<TeleprompterProgress>({ activeSentence: 0, remainingSeconds: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const [showBooks, setShowBooks] = useState(false);
  // Settings start collapsed on phones so the script keeps most of the screen.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const booksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) setAutoScrollOn(false);
  }, [reducedMotion]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    setSettingsOpen(desktop);
    if (!window.matchMedia("(min-width: 640px)").matches) setFontIndex(DEFAULT_FONT_INDEX - 1);
  }, []);

  const isRecording = state.status === "recording";
  const isLive = state.status === "recording" || state.status === "paused";

  // Elapsed recording time (mock clock; real capture duration in Phase 2).
  useEffect(() => {
    if (!isRecording) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: "tick", deltaMs: now - last });
      last = now;
    }, 250);
    return () => window.clearInterval(id);
  }, [isRecording]);

  // Backgrounding: pause rather than silently keep going (Amendment §A).
  useEffect(() => {
    if (!isRecording) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        dispatch({ type: "pause" });
        setNotice("Recording paused because the page was hidden. Tap Resume when you're ready.");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isRecording]);

  // Keyboard: Space pause/resume, +/- speed. Arrow keys scroll the focused script.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "BUTTON", "SELECT", "TEXTAREA", "A"].includes(target.tagName)) return;
      if (e.key === " ") {
        if (state.status === "recording") dispatch({ type: "pause" });
        else if (state.status === "paused") dispatch({ type: "resume" });
        else return;
        e.preventDefault();
      } else if (e.key === "+" || e.key === "=") {
        setWpm((w) => clampWpm(w + WPM_STEP));
      } else if (e.key === "-") {
        setWpm((w) => clampWpm(w - WPM_STEP));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.status]);

  useEffect(() => {
    if (showBooks) booksRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  }, [showBooks, reducedMotion]);

  const onProgress = useCallback((p: TeleprompterProgress) => setProgress(p), []);

  const startOver = () => {
    setNotice(null);
    setShowBooks(false);
    dispatch({ type: "start_over" });
  };

  if (state.status === "consent") {
    return <ConsentStep state={state} dispatch={dispatch} />;
  }

  const guidance = durationGuidance(state.elapsedMs);
  const fontSizePx = FONT_SIZES[fontIndex] ?? FONT_SIZES[DEFAULT_FONT_INDEX];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid h-[calc(100dvh-7.5rem)] min-h-[520px] grid-rows-[minmax(0,1fr)_auto] gap-3 lg:h-[calc(100dvh-7.5rem)] lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-1 lg:gap-6">
        <div className="relative min-h-0">
          <Teleprompter
            script={script}
            autoScroll={isRecording && autoScrollOn}
            wpm={wpm}
            fontSizePx={fontSizePx}
            resetKey={state.take}
            onProgress={onProgress}
          />
          {!autoScrollOn && isLive && (
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white">
              Auto-scroll is off. Drag or use arrow keys to move the script.
            </p>
          )}
        </div>

        <aside
          aria-label="Recording controls"
          className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(40,53,72,0.08)] lg:gap-5 lg:p-6 lg:shadow-none"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-display text-lg font-semibold" role="status" aria-live="polite">
              <span
                aria-hidden="true"
                className={`size-3 rounded-full ${isRecording ? "animate-pulse bg-coral-deep" : state.status === "paused" ? "bg-sunshine" : "bg-muted/40"}`}
              />
              {STATUS_LABEL[state.status]}
            </p>
            <p className="font-display text-2xl tabular-nums" aria-label={`Elapsed ${formatClock(state.elapsedMs)}`}>
              {formatClock(state.elapsedMs)}
            </p>
          </div>

          <DurationBar elapsedMs={state.elapsedMs} />

          <p className="text-xs text-muted sm:text-sm" data-testid="duration-guidance">
            {state.status === "ready"
              ? "Aim for 1 to 2 minutes of clear, natural reading. There's no rush and no cut-off."
              : guidance === "too_short"
                ? `Keep going: about ${progress.remainingSeconds}s of script left at this speed.`
                : guidance === "in_range"
                  ? "Great length. Finish whenever you reach a natural stopping point."
                  : "That's plenty. Finish when you're ready."}
          </p>

          <InputMeter />

          {notice && (
            <p role="alert" className="rounded-2xl bg-sunshine/40 p-3 text-sm">
              {notice}
            </p>
          )}

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 lg:grid-cols-2">
            {state.status === "ready" && (
              <button type="button" className={`${buttonPrimary} col-span-3 lg:col-span-2`} onClick={() => dispatch({ type: "start" })}>
                Start recording
              </button>
            )}
            {state.status === "recording" && (
              <button type="button" className={buttonSecondary} onClick={() => dispatch({ type: "pause" })}>
                Pause
              </button>
            )}
            {state.status === "paused" && (
              <button
                type="button"
                className={buttonSecondary}
                onClick={() => {
                  setNotice(null);
                  dispatch({ type: "resume" });
                }}
              >
                Resume
              </button>
            )}
            {isLive && (
              <button type="button" className={buttonPrimary} onClick={() => dispatch({ type: "finish" })}>
                Finish
              </button>
            )}
            {(isLive || state.status === "review") && (
              <button
                type="button"
                className={`${buttonSecondary} whitespace-nowrap !px-4 !text-base ${state.status === "review" ? "col-span-3" : ""} lg:col-span-2`}
                onClick={startOver}
              >
                Start over
              </button>
            )}
          </div>

          {state.status === "review" && (
            <ReviewPanel elapsedMs={state.elapsedMs} onContinue={() => setShowBooks(true)} />
          )}

          <details
            className="rounded-2xl border-2 border-ink/10 p-3"
            open={settingsOpen}
            onToggle={(e) => setSettingsOpen(e.currentTarget.open)}
          >
            <summary className="cursor-pointer font-display font-semibold">Reading settings</summary>
            <div className="mt-3 flex flex-col gap-3">
              <Stepper
                label="Scroll speed"
                value={`${wpm} words/min`}
                onDecrease={() => setWpm((w) => clampWpm(w - WPM_STEP))}
                onIncrease={() => setWpm((w) => clampWpm(w + WPM_STEP))}
              />
              <Stepper
                label="Text size"
                value={`${fontSizePx}px`}
                onDecrease={() => setFontIndex((i) => Math.max(0, i - 1))}
                onIncrease={() => setFontIndex((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
              />
              <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
                <span>Auto-scroll while recording</span>
                <input
                  type="checkbox"
                  className="size-6 accent-coral-deep"
                  checked={autoScrollOn}
                  onChange={(e) => setAutoScrollOn(e.target.checked)}
                />
              </label>
              <p className="text-xs text-muted">Space pauses or resumes. Plus and minus change speed.</p>
            </div>
          </details>
        </aside>
      </div>

      {showBooks && (
        <div ref={booksRef} className="scroll-mt-6">
          <DemoBookShelf heading="Your take is in. Pick a story to hear it." />
          <p className="mt-4 text-sm text-muted">
            Real voice previews arrive in the next phase. Nothing here plays a fake or stock voice.
          </p>
        </div>
      )}
    </div>
  );
}

function ConsentStep({
  state,
  dispatch,
}: {
  state: typeof initialRecorderState;
  dispatch: React.Dispatch<Parameters<typeof recorderReducer>[1]>;
}) {
  const ready = state.consent.adultOwner && state.consent.processing;
  return (
    <form
      className="mx-auto flex max-w-xl flex-col gap-5 rounded-[var(--radius-panel)] bg-surface p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        dispatch({ type: "accept_consent" });
      }}
      aria-labelledby="consent-heading"
    >
      <h1 id="consent-heading" className="font-display text-3xl font-semibold">
        Before you record
      </h1>
      <p>
        You&apos;ll read one short story script aloud for about 1 to 2 minutes. We use that recording only to make a
        short private preview in your voice. It is never public and is deleted automatically within 24 hours unless you
        choose to save it.
      </p>
      <label className="flex min-h-11 gap-3">
        <input
          type="checkbox"
          className="mt-1 size-6 shrink-0 accent-coral-deep"
          checked={state.consent.adultOwner}
          onChange={(e) => dispatch({ type: "set_consent", field: "adultOwner", value: e.target.checked })}
        />
        <span>I&apos;m 18 or older and this is my own voice. I&apos;ll be the only person speaking.</span>
      </label>
      <label className="flex min-h-11 gap-3">
        <input
          type="checkbox"
          className="mt-1 size-6 shrink-0 accent-coral-deep"
          checked={state.consent.processing}
          onChange={(e) => dispatch({ type: "set_consent", field: "processing", value: e.target.checked })}
        />
        <span>I agree that Readli may process this recording with its voice provider to create my private preview.</span>
      </label>
      <button type="submit" className={buttonPrimary} disabled={!ready}>
        Continue to recording
      </button>
      <p className="text-sm text-muted">
        No account or email needed. <Link href="/privacy" className="underline">How we handle voice recordings</Link>
      </p>
    </form>
  );
}

function DurationBar({ elapsedMs }: { elapsedMs: number }) {
  const pct = Math.min(100, (elapsedMs / TARGET_MAX_MS) * 100);
  const minPct = (TARGET_MIN_MS / TARGET_MAX_MS) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative h-3 overflow-hidden rounded-full bg-ivory"
        role="progressbar"
        aria-label="Recording length toward the 1 to 2 minute target"
        aria-valuemin={0}
        aria-valuemax={TARGET_MAX_MS / 1000}
        aria-valuenow={Math.round(elapsedMs / 1000)}
      >
        <div className="h-full rounded-full bg-mint transition-[width]" style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-ink/40" style={{ left: `${minPct}%` }} aria-hidden="true" />
      </div>
      <div className="relative hidden h-4 text-xs text-muted sm:block" aria-hidden="true">
        <span className="absolute left-0">0:00</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${minPct}%` }}>
          1:00
        </span>
        <span className="absolute right-0">2:00</span>
      </div>
    </div>
  );
}

function InputMeter() {
  // Phase 1 has no microphone. Show an empty meter rather than a fabricated one.
  return (
    <div className="flex items-center gap-3" data-testid="input-meter">
      <span className="text-sm">Mic level</span>
      <div className="flex h-4 flex-1 items-end gap-0.5" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className="h-1 flex-1 rounded-sm bg-ink/15" />
        ))}
      </div>
      <span className="text-xs text-muted">Preview: no mic</span>
    </div>
  );
}

function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2" role="group" aria-label={label}>
      <span className="whitespace-nowrap text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDecrease}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="size-11 rounded-full border-2 border-ink font-display text-xl"
        >
          −
        </button>
        <span className="w-24 text-center text-sm tabular-nums" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={onIncrease}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="size-11 rounded-full border-2 border-ink font-display text-xl"
        >
          +
        </button>
      </div>
    </div>
  );
}

function ReviewPanel({ elapsedMs, onContinue }: { elapsedMs: number; onContinue: () => void }) {
  const guidance = durationGuidance(elapsedMs);
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-mint/40 p-4" data-testid="review-panel">
      <p className="font-display text-lg font-semibold">Nice reading! {formatClock(elapsedMs)} recorded.</p>
      {guidance === "too_short" && (
        <p className="text-sm">
          That&apos;s under a minute, which may not be enough for a good voice match. You can start over or continue
          anyway.
        </p>
      )}
      <button type="button" disabled className={buttonSecondary} title="Playback arrives with real recording">
        Play my take
      </button>
      <button type="button" className={buttonPrimary} onClick={onContinue}>
        Choose a story
      </button>
    </div>
  );
}

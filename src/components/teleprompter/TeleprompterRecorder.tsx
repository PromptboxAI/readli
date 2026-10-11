"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { splitSentences, type VoiceScriptVersion } from "@/lib/content/voice-scripts";
import {
  canFinish,
  durationGuidance,
  formatClock,
  initialRecorderState,
  recorderReducer,
  TARGET_MAX_MS,
  TARGET_MIN_MS,
} from "@/lib/teleprompter/recorder-machine";
import { clampWpm, DEFAULT_FONT_INDEX, DEFAULT_WPM, FONT_SIZES, WPM_STEP } from "@/lib/teleprompter/scroll";
import { QC_MESSAGES } from "@/lib/audio/qc";
import { Teleprompter, type TeleprompterProgress } from "./Teleprompter";
import { MIC_ERROR_MESSAGES, useMicrophone, type RecordedTake } from "./useMicrophone";
import { VoicePreview, type TakeDetails } from "./VoicePreview";

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

interface TeleprompterRecorderProps {
  script: VoiceScriptVersion;
  /**
   * For signed-in voices: consent was already given on the page, so recording starts at Ready, and
   * a finished take goes to this callback instead of the guest story previews.
   */
  onTake?: (take: TakeDetails) => void;
  takeActionLabel?: string;
  /** Shown under a story once the guest has heard it in their voice, such as the free-trial sign-up. */
  afterListen?: React.ReactNode;
}

export function TeleprompterRecorder({ script, onTake, takeActionLabel = "Choose a story", afterListen }: TeleprompterRecorderProps) {
  const [state, dispatch] = useReducer(recorderReducer, initialRecorderState, (s) =>
    onTake ? { ...s, status: "ready" as const, consent: { adultOwner: true, processing: true } } : s,
  );
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
  const [take, setTake] = useState<{ url: string; recorded: RecordedTake; details: TakeDetails } | null>(null);
  const [starting, setStarting] = useState(false);
  const [interruptions, setInterruptions] = useState(0);
  const mic = useMicrophone({ onInterrupted: () => setInterruptions((n) => n + 1) });

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

  // Elapsed recording time for the on-screen clock. The take's own duration comes from the recorder.
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

  const pauseRecording = useCallback(
    (reason?: string) => {
      mic.pause();
      dispatch({ type: "pause" });
      if (reason) setNotice(reason);
    },
    [mic],
  );

  const resumeRecording = () => {
    setNotice(null);
    mic.resume();
    dispatch({ type: "resume" });
  };

  const startRecording = async () => {
    setNotice(null);
    setStarting(true);
    const ok = await mic.start();
    setStarting(false);
    if (ok) dispatch({ type: "start" });
  };

  const finishRecording = async () => {
    if (!canFinish(state.elapsedMs)) return;
    const recorded = await mic.stop();
    mic.close(); // release the microphone as soon as the take is done
    if (recorded) {
      // Script position reached, as a character offset into the script (Amendment 001 §D).
      const sentences = script.paragraphs.flatMap(splitSentences);
      const scriptOffsetEnd = sentences.slice(0, progress.activeSentence + 1).join(" ").length;
      setTake({
        url: URL.createObjectURL(recorded.blob),
        recorded,
        details: { takeNumber: state.take, recorded, wpm, pauseCount: state.pauseCount, scriptOffsetEnd },
      });
    }
    setNotice(null);
    dispatch({ type: "finish" });
  };

  // Calls, Siri, unplugged headsets: pause instead of recording silence.
  useEffect(() => {
    if (interruptions > 0 && isRecording) pauseRecording(MIC_ERROR_MESSAGES.interrupted);
    // Only react to new interruptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interruptions]);

  // Backgrounding: pause rather than silently keep going (Amendment §A).
  useEffect(() => {
    if (!isRecording) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        pauseRecording("Recording paused because the page was hidden. Tap Resume when you're ready.");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isRecording, pauseRecording]);

  useEffect(() => {
    return () => {
      if (take) URL.revokeObjectURL(take.url);
    };
  }, [take]);

  // Keyboard: Space pause/resume, +/- speed. Arrow keys scroll the focused script.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "BUTTON", "SELECT", "TEXTAREA", "A"].includes(target.tagName)) return;
      if (e.key === " ") {
        if (state.status === "recording") pauseRecording();
        else if (state.status === "paused") resumeRecording();
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
  });

  useEffect(() => {
    if (showBooks) booksRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  }, [showBooks, reducedMotion]);

  const onProgress = useCallback((p: TeleprompterProgress) => setProgress(p), []);

  const startOver = () => {
    mic.discard();
    setTake(null);
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

          {state.status !== "review" && (
          <p className="text-xs text-muted sm:text-sm" data-testid="duration-guidance">
            {state.status === "ready"
              ? "Read for at least 1 minute, ideally 1 to 2. Finish unlocks at 1:00."
              : guidance === "too_short"
                ? progress.remainingSeconds > 0
                  ? `Keep going: Finish unlocks at 1:00. About ${progress.remainingSeconds}s of script left at this speed.`
                  : "Almost there. Keep reading until 1:00, from the top again if you need to."
                : guidance === "in_range"
                  ? "Great length. Finish whenever you reach a natural stopping point."
                  : "That's plenty. Finish when you're ready."}
          </p>
          )}

          {state.status !== "review" && <InputMeter levelRef={mic.levelRef} active={mic.isOpen} />}

          {mic.error && (
            <p role="alert" className="rounded-2xl bg-coral/25 p-3 text-sm">
              {MIC_ERROR_MESSAGES[mic.error]}
            </p>
          )}

          {notice && (
            <p role="alert" className="rounded-2xl bg-sunshine/40 p-3 text-sm">
              {notice}
            </p>
          )}

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 lg:grid-cols-2">
            {state.status === "ready" && !mic.isOpen && (
              <button
                type="button"
                className={`${buttonSecondary} col-span-3 !text-base lg:col-span-2`}
                onClick={() => void mic.open()}
              >
                Test my microphone
              </button>
            )}
            {state.status === "ready" && (
              <button
                type="button"
                className={`${buttonPrimary} col-span-3 lg:col-span-2`}
                disabled={starting}
                onClick={() => void startRecording()}
              >
                {starting ? "Starting…" : "Start recording"}
              </button>
            )}
            {state.status === "recording" && (
              <button type="button" className={buttonSecondary} onClick={() => pauseRecording()}>
                Pause
              </button>
            )}
            {state.status === "paused" && (
              <button type="button" className={buttonSecondary} onClick={resumeRecording}>
                Resume
              </button>
            )}
            {isLive && (
              <button
                type="button"
                className={buttonPrimary}
                disabled={!canFinish(state.elapsedMs)}
                onClick={() => void finishRecording()}
              >
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

          {state.status === "ready" && (
            <p className="rounded-2xl bg-sunshine/40 p-3 text-sm" data-testid="expressive-tip">
              <span className="font-semibold">Read it like a bedtime story.</span> Be warm, lively and expressive, not a flat
              reading voice. Your Readli voice copies how you sound here.
            </p>
          )}

          {state.status === "ready" && (
            <p className="text-xs text-muted">
              Find a quiet room, use earphones with a mic if you have them, and make sure you&apos;re the only one
              speaking.
            </p>
          )}

          {state.status === "review" && (
            <ReviewPanel
              take={take}
              actionLabel={takeActionLabel}
              onContinue={() => (onTake && take ? onTake(take.details) : setShowBooks(true))}
            />
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

      {showBooks && take && (
        <div ref={booksRef} className="scroll-mt-6">
          <VoicePreview key={take.details.takeNumber} take={take.details} heading="Your take is in. Pick a story to hear it." afterListen={afterListen} />
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
        You&apos;ll read one short story script aloud for at least 1 minute, ideally 1 to 2. We use that recording only to make a
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

function InputMeter({ levelRef, active }: { levelRef: React.RefObject<number>; active: boolean }) {
  const barsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bars = barsRef.current?.children;
    if (!bars) return;
    if (!active) {
      for (const bar of Array.from(bars)) (bar as HTMLElement).style.background = "";
      return;
    }
    let frame = 0;
    const draw = () => {
      // Perceptual scale so normal speech fills most of the meter.
      const lit = Math.round(Math.min(1, Math.sqrt(levelRef.current) * 1.4) * bars.length);
      Array.from(bars).forEach((bar, i) => {
        (bar as HTMLElement).style.background =
          i < lit ? (i > bars.length * 0.85 ? "var(--color-coral-deep)" : "var(--color-mint)") : "";
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, levelRef]);

  return (
    <div className="flex items-center gap-3" data-testid="input-meter">
      <span className="text-sm">Mic level</span>
      <div ref={barsRef} className="flex h-4 flex-1 items-end gap-0.5" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className="h-full flex-1 rounded-sm bg-ink/15" />
        ))}
      </div>
      <span className="w-16 text-right text-xs text-muted">{active ? "Listening" : "Mic off"}</span>
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

function ReviewPanel({
  take,
  actionLabel,
  onContinue,
}: {
  actionLabel: string;
  take: { url: string; recorded: RecordedTake } | null;
  onContinue: () => void;
}) {
  if (!take) {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-coral/25 p-4">
        <p className="font-display text-lg font-semibold">We didn&apos;t get any audio from that take.</p>
        <p className="text-sm">Tap Start over to try again.</p>
      </div>
    );
  }
  const { recorded } = take;
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-mint/40 p-4" data-testid="review-panel">
      <p className="font-display text-lg font-semibold">Nice reading! {formatClock(recorded.durationMs)} recorded.</p>
      <audio controls src={take.url} className="w-full" aria-label="Play back your recording" />
      {recorded.qc.issues.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm" data-testid="qc-issues">
          {recorded.qc.issues.map((issue) => (
            <li key={issue}>{QC_MESSAGES[issue]}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        These checks are a guide. You can start over or continue. Your recording stays in this browser for now.
      </p>
      <button type="button" className={buttonPrimary} onClick={onContinue}>
        {actionLabel}
      </button>
    </div>
  );
}

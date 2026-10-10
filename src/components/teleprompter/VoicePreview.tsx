"use client";

import { useEffect, useRef, useState } from "react";
import { DemoBookShelf } from "@/components/books/DemoBookShelf";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import type { DemoBook } from "@/lib/content/demo-books";
import type { RecordedTake } from "./useMicrophone";

type Mode = "live" | "stub" | "off" | "loading";
type Phase = "idle" | "saving" | "cloning" | "reading" | "playing" | "error";

export interface TakeDetails {
  /** Changes on every new take, so a retake makes a fresh voice. */
  takeNumber: number;
  recorded: RecordedTake;
  wpm: number;
  pauseCount: number;
  scriptOffsetEnd: number | null;
}

const PHASE_COPY: Partial<Record<Phase, string>> = {
  saving: "Saving your recording…",
  cloning: "Readi is listening to your voice…",
  reading: "Getting your story ready…",
};

const OFF_REASON = "Voice previews switch on soon.";

function deviceClass(): "phone" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 640 ? "phone" : w < 1024 ? "tablet" : "desktop";
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

/** Turns the finished take into a voice and reads a demo passage in it (PRD F-01, brief §6). */
export function VoicePreview({ take, heading }: { take: TakeDetails; heading: string }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewsLeft, setPreviewsLeft] = useState<number | null>(null);
  const [playing, setPlaying] = useState<{ book: DemoBook; url: string; standIn: boolean } | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const voiceForTake = useRef<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo/status", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ mode: Mode; guest: { previewsLeft: number } | null }>)
      .then((s) => {
        if (cancelled) return;
        setMode(s.mode);
        if (s.guest) setPreviewsLeft(s.guest.previewsLeft);
      })
      .catch(() => !cancelled && setMode("off"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (playing) URL.revokeObjectURL(playing.url);
    };
  }, [playing]);

  const ensureVoice = async (): Promise<boolean> => {
    if (voiceForTake.current === take.takeNumber) return true;

    setPhase("saving");
    const session = await fetch("/api/guest/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // The guest ticked both boxes before the microphone opened.
      body: JSON.stringify({ adultOwner: true, processing: true }),
    });
    if (!session.ok) throw new Error(await errorMessage(session, OFF_REASON));
    const { previewsLeft: left } = (await session.json()) as { previewsLeft: number };
    setPreviewsLeft(left);

    const form = new FormData();
    form.append("audio", take.recorded.blob, "take");
    form.append("durationMs", String(Math.round(take.recorded.durationMs)));
    form.append("wpm", String(take.wpm));
    form.append("pauseCount", String(take.pauseCount));
    form.append("deviceClass", deviceClass());
    if (take.scriptOffsetEnd !== null) form.append("scriptOffsetEnd", String(take.scriptOffsetEnd));
    const upload = await fetch("/api/guest/recording", { method: "POST", body: form });
    if (!upload.ok) throw new Error(await errorMessage(upload, "We couldn't save your recording. Please try again."));

    setPhase("cloning");
    const clone = await fetch("/api/guest/clone", { method: "POST" });
    if (!clone.ok) throw new Error(await errorMessage(clone, "We couldn't make your voice just now. Please try again."));
    voiceForTake.current = take.takeNumber;
    return true;
  };

  const hear = async (book: DemoBook) => {
    setError(null);
    setActiveSlug(book.slug);
    try {
      await ensureVoice();
      setPhase("reading");
      const res = await fetch("/api/demo/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: book.slug }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "We couldn't read that story just now. Please try again."));
      const left = Number(res.headers.get("x-readli-previews-left"));
      if (Number.isFinite(left)) setPreviewsLeft(left);
      const url = URL.createObjectURL(await res.blob());
      setPlaying({ book, url, standIn: res.headers.get("x-readli-stand-in") === "1" });
      setPhase("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPhase("error");
      setActiveSlug(playing?.book.slug ?? null);
    }
  };

  const busy = phase === "saving" || phase === "cloning" || phase === "reading";

  // Keep the loader and player in view; on phones they sit above a tall shelf.
  useEffect(() => {
    if (busy || phase === "playing" || phase === "error") topRef.current?.scrollIntoView({ block: "start" });
  }, [busy, phase]);
  const disabledReason =
    mode === "loading"
      ? "Checking voice previews…"
      : mode === "off"
        ? OFF_REASON
        : busy
          ? "One story at a time."
          : previewsLeft === 0
            ? "You've used your free previews."
            : null;

  return (
    <div ref={topRef} className="flex scroll-mt-20 flex-col gap-5" data-testid="voice-preview">
      {busy && (
        <div role="status" className="flex items-center gap-4 rounded-panel bg-plum p-5 text-white">
          <ReadiMascot state="listening" size={110} decorative className="animate-bob" />
          <p className="font-display text-xl font-semibold">{PHASE_COPY[phase]}</p>
        </div>
      )}

      {playing && !busy && (
        <div className="flex flex-col gap-3 rounded-panel bg-plum p-5 text-white sm:flex-row sm:items-center">
          <ReadiMascot state="listening" size={110} decorative className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-display text-xl font-semibold">
              {playing.book.title} · read by you
            </p>
            <audio key={playing.url} controls autoPlay src={playing.url} className="w-full" aria-label={`${playing.book.title}, read in your voice`} />
            {playing.standIn && (
              <p className="rounded-xl bg-sunshine px-3 py-2 text-sm font-semibold text-ink">
                Test mode: this is a stand-in sound, not your voice.
              </p>
            )}
            <details className="text-sm text-white/85">
              <summary className="cursor-pointer font-semibold">Read along</summary>
              <p className="mt-2 leading-relaxed">{playing.book.passageText}</p>
            </details>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-2xl border-[3px] border-coral-deep bg-surface p-4 font-semibold">
          {error}
        </p>
      )}

      <DemoBookShelf heading={heading} onHear={hear} activeSlug={busy || playing ? activeSlug : null} disabledReason={disabledReason} />

      <p className="text-sm text-muted">
        {mode === "off"
          ? "We never play a stock voice as if it were yours."
          : previewsLeft !== null
            ? `${previewsLeft} free ${previewsLeft === 1 ? "preview" : "previews"} left. Your recording and voice are deleted within 24 hours.`
            : "Your recording and voice are deleted within 24 hours. We never play a stock voice as if it were yours."}
      </p>
    </div>
  );
}

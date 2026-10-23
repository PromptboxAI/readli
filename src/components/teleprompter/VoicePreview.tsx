"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { DemoBookShelf } from "@/components/books/DemoBookShelf";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import type { DemoBook } from "@/lib/content/demo-books";
import { ImproveLink, RecordingTipsDialog } from "./RecordingTips";
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
  /** The reader asked how to improve before recording this take. */
  afterFeedback?: boolean;
}

interface Played {
  book: DemoBook;
  url: string;
  standIn: boolean;
  cleanUp: boolean;
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

/**
 * Turns the finished take into a voice and reads demo passages in it (PRD F-01, brief §6). Each
 * story read in a voice is kept, so replays are instant and never use up a preview.
 */
export function VoicePreview({
  take,
  heading,
  onRecordAgain,
  nextSteps = false,
  resumeCleanUp = false,
}: {
  /** Null when coming back to the voice already saved for this guest (no new take to upload). */
  take: TakeDetails | null;
  /** With no take: the noise clean-up setting the saved voice was made with. */
  resumeCleanUp?: boolean;
  heading: string;
  onRecordAgain?: () => void;
  /** After the first story, offer a Readli Voice account or Readli Family that keep this recording. */
  nextSteps?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("loading");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewsLeft, setPreviewsLeft] = useState<number | null>(null);
  const [previewsAllowed, setPreviewsAllowed] = useState<number | null>(null);
  const [playing, setPlaying] = useState<Played | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  /** Stories already read, by voice ("take:clean-up") and book. */
  const heard = useRef(new Map<string, Played>());
  const [, setHeardCount] = useState(0);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  // Noise clean-up starts on only when the recorder heard a noisy room; quiet takes keep their natural sound.
  const [cleanUp, setCleanUp] = useState(() => (take ? take.recorded.qc.issues.includes("noisy") : resumeCleanUp));
  const uploadedTake = useRef<number | null>(null);
  const takeId = take ? String(take.takeNumber) : "saved";
  /** The take and clean-up setting the current voice was made from. A saved voice is already made. */
  const voiceMadeFrom = useRef<string | null>(take ? null : `saved:${resumeCleanUp}`);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo/status", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ mode: Mode; guest: { previewsLeft: number; previewsAllowed: number } | null }>)
      .then((s) => {
        if (cancelled) return;
        setMode(s.mode);
        if (s.guest) {
          setPreviewsLeft(s.guest.previewsLeft);
          setPreviewsAllowed(s.guest.previewsAllowed);
        }
      })
      .catch(() => !cancelled && setMode("off"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cache = heard.current;
    return () => {
      for (const p of cache.values()) URL.revokeObjectURL(p.url);
    };
  }, []);

  const voiceKey = `${takeId}:${cleanUp}`;
  const explored = new Set([...heard.current.keys()].filter((k) => k.startsWith(`${voiceKey}|`)).map((k) => k.split("|")[1]!));

  const ensureVoice = async (): Promise<boolean> => {
    const voiceKey = `${takeId}:${cleanUp}`;
    if (voiceMadeFrom.current === voiceKey) return true;
    // Switching clean-up on or off re-makes the voice from the saved take; no need to upload again.
    if (take && uploadedTake.current !== take.takeNumber) await uploadTake(take);

    setPhase("cloning");
    const clone = await fetch("/api/guest/clone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ removeBackgroundNoise: cleanUp }),
    });
    if (!clone.ok) throw new Error(await errorMessage(clone, "We couldn't make your voice just now. Please try again."));
    voiceMadeFrom.current = voiceKey;
    return true;
  };

  const uploadTake = async (take: TakeDetails) => {
    setPhase("saving");
    const session = await fetch("/api/guest/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // The guest ticked both boxes before the microphone opened.
      body: JSON.stringify({ adultOwner: true, processing: true }),
    });
    if (!session.ok) throw new Error(await errorMessage(session, OFF_REASON));
    const counts = (await session.json()) as { previewsLeft: number; previewsAllowed: number };
    setPreviewsLeft(counts.previewsLeft);
    setPreviewsAllowed(counts.previewsAllowed);

    const form = new FormData();
    form.append("audio", take.recorded.blob, "take");
    form.append("durationMs", String(Math.round(take.recorded.durationMs)));
    form.append("wpm", String(take.wpm));
    form.append("pauseCount", String(take.pauseCount));
    form.append("deviceClass", deviceClass());
    if (take.scriptOffsetEnd !== null) form.append("scriptOffsetEnd", String(take.scriptOffsetEnd));
    form.append("takeNumber", String(take.takeNumber));
    form.append("afterFeedback", String(Boolean(take.afterFeedback)));
    for (const issue of take.recorded.qc.issues) form.append("qcIssue", issue);
    const upload = await fetch("/api/guest/recording", { method: "POST", body: form });
    if (!upload.ok) throw new Error(await errorMessage(upload, "We couldn't save your recording. Please try again."));
    uploadedTake.current = take.takeNumber;
  };

  const hear = async (book: DemoBook) => {
    setError(null);
    setActiveSlug(book.slug);
    const already = voiceMadeFrom.current === voiceKey ? heard.current.get(`${voiceKey}|${book.slug}`) : undefined;
    if (already) {
      setPlaying({ ...already });
      setPhase("playing");
      return;
    }
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
      if (res.headers.has("x-readli-previews-left") && Number.isFinite(left)) setPreviewsLeft(left);
      const allowed = Number(res.headers.get("x-readli-previews-allowed"));
      if (res.headers.has("x-readli-previews-allowed") && Number.isFinite(allowed)) setPreviewsAllowed(allowed);
      const played: Played = { book, url: URL.createObjectURL(await res.blob()), standIn: res.headers.get("x-readli-stand-in") === "1", cleanUp };
      heard.current.set(`${voiceKey}|${book.slug}`, played);
      setHeardCount(heard.current.size);
      setPlaying(played);
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
  // Back from signup we don't know which stories were heard, so the server says which ones replay.
  const outOfStories = previewsLeft === 0 && take !== null;
  const disabledReason =
    mode === "loading"
      ? "Checking voice previews…"
      : mode === "off"
        ? OFF_REASON
        : busy
          ? "One story at a time."
          : outOfStories
            ? "You've explored all your free stories."
            : null;
  const used = previewsLeft !== null && previewsAllowed !== null ? Math.max(0, previewsAllowed - previewsLeft) : null;

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
            <p className="text-sm text-white/85">Noise clean-up {playing.cleanUp ? "on" : "off"}</p>
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
            <ImproveLink onOpen={() => setTipsOpen(true)} where="guest_preview" />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-2xl border-[3px] border-coral-deep bg-surface p-4 font-semibold">
          {error}
        </p>
      )}

      {nextSteps && !busy && (playing || previewsLeft === 0 || !take) && <NextSteps cleanUp={playing?.cleanUp ?? cleanUp} />}

      {mode !== "off" && (
        <label className="flex min-h-11 items-start gap-3 rounded-2xl border-2 border-ink/10 bg-surface p-4">
          <input
            type="checkbox"
            className="mt-1 size-6 shrink-0 accent-coral-deep"
            checked={cleanUp}
            disabled={busy}
            onChange={(e) => setCleanUp(e.target.checked)}
          />
          <span className="flex flex-col gap-1">
            <span className="font-semibold">Clean up background noise</span>
            <span className="text-sm text-muted">
              Helps with echoey or noisy rooms, but it can make a clean recording sound less like you. Change it and pick a
              story again to hear the difference.
            </span>
          </span>
        </label>
      )}

      {used !== null && previewsAllowed !== null && mode !== "off" && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4" data-testid="preview-counter">
          <p className="font-display text-lg font-semibold">
            {used} of {previewsAllowed} stories explored
          </p>
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: previewsAllowed }, (_, i) => (
              <span key={i} className={`h-2.5 flex-1 rounded-full ${i < used ? "bg-coral-deep" : "bg-ink/15"}`} />
            ))}
          </div>
          <p className="text-sm text-muted">
            {previewsLeft === 0
              ? "That's all the free stories for this demo. Stories you've heard play again any time today."
              : "Replaying a story you've already heard is free."}
          </p>
        </div>
      )}

      <DemoBookShelf
        heading={heading}
        onHear={hear}
        activeSlug={busy || playing ? activeSlug : null}
        disabledReason={disabledReason}
        explored={explored}
        busy={busy}
      />

      <p className="text-sm text-muted">
        {mode === "off"
          ? "We never play a stock voice as if it were yours."
          : "Your recording and voice are deleted within 24 hours. We never play a stock voice as if it were yours."}
      </p>
      <RecordingTipsDialog open={tipsOpen} onClose={() => setTipsOpen(false)} onRecordAgain={onRecordAgain} where="guest_preview" />
    </div>
  );
}

/**
 * Where a guest goes once they've heard themselves. Both paths keep the take: signing in within the
 * guest's 24 hours offers it on /voice/record, so nobody reads the story again.
 */
function NextSteps({ cleanUp }: { cleanUp: boolean }) {
  const carry = `from=try${cleanUp ? "&cleanup=1" : ""}`;
  return (
    <section aria-labelledby="next-steps-heading" className="flex flex-col gap-4 rounded-panel bg-surface p-5 ring-2 ring-ink/10 sm:p-6" data-testid="try-next-steps">
      <div className="flex flex-col gap-1">
        <h2 id="next-steps-heading" className="font-display text-2xl font-semibold">
          Keep your voice
        </h2>
        <p className="text-sm text-muted">Your recording comes with you, so you won&apos;t read the story again. Save it within 24 hours.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl bg-mint/50 p-4">
          <p className="font-display text-lg font-semibold">Read to your family&apos;s kids</p>
          <p className="text-sm">Make a free Readli Voice account and invite the families you love. They choose which children hear you.</p>
          <Link href={`/signup/voice?${carry}`} className={`${buttonPrimary} mt-auto w-full`}>
            Share my voice, free
          </Link>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl bg-sunshine/50 p-4">
          <p className="font-display text-lg font-semibold">Read to your own kids</p>
          <p className="text-sm">Start Readli Family: classic stories in your voice and your storytellers&apos; voices, for every child.</p>
          <Link href={`/signup/family?${carry}`} className={`${buttonSecondary} mt-auto w-full`}>
            Start Readli Family
          </Link>
        </div>
      </div>
    </section>
  );
}

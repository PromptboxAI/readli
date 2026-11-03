"use client";

import { useEffect, useRef, useState } from "react";
import { parentPrimary } from "@/components/brand/buttons";

/**
 * Setup's Listen step: a small player under the book that reads it through, sentence by sentence, with the
 * words showing. The full player stays in Books; setup never leaves for it.
 */
export function SetupMiniPlayer({ slug, voiceId, revision, sentences, ready }: { slug: string; voiceId: string; revision: string; sentences: string[]; ready: boolean[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const next = useRef<{ at: number; url: Promise<string | null> } | null>(null);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const urlFor = async (i: number): Promise<string | null> => {
    const res = await fetch(`/api/family/books/${slug}/listen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voiceId, sentence: i, revision }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setMessage(body?.error?.message ?? "This story isn't available right now.");
      return null;
    }
    return ((await res.json()) as { url: string }).url;
  };

  const nextReady = (from: number) => {
    for (let i = from; i < sentences.length; i++) if (ready[i]) return i;
    return -1;
  };

  const playFrom = async (i: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (i < 0) {
      setPlaying(false);
      setDone(true);
      setAt(0);
      return;
    }
    setAt(i);
    setLoading(true);
    const url = next.current?.at === i ? await next.current.url : await urlFor(i);
    next.current = null;
    if (!url) {
      setLoading(false);
      setPlaying(false);
      return;
    }
    audio.src = url;
    try {
      await audio.play();
      setPlaying(true);
      setDone(false);
      setMessage(null);
      // The next sentence is fetched while this one plays, so the story flows.
      const after = nextReady(i + 1);
      if (after >= 0) next.current = { at: after, url: urlFor(after) };
    } catch {
      setPlaying(false);
      setMessage("Tap play to start.");
    }
    setLoading(false);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const ended = () => void playFrom(nextReady(at + 1));
    audio.addEventListener("ended", ended);
    return () => audio.removeEventListener("ended", ended);
  });

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else if (audio.src && !done && !audio.ended) {
      void audio.play().then(() => setPlaying(true));
    } else {
      void playFrom(nextReady(0));
    }
  };

  const total = ready.filter(Boolean).length || 1;
  const progress = Math.round((ready.slice(0, at).filter(Boolean).length / total) * 100);

  return (
    <div className="flex w-full flex-col gap-3" data-testid="setup-mini-player">
      <audio ref={audioRef} preload="none" />
      <div className="flex items-center gap-3">
        <button type="button" className={parentPrimary} onClick={toggle} disabled={loading && !playing} aria-label={playing ? "Pause" : "Play"}>
          {loading ? "Loading…" : playing ? "Pause" : done ? "Play again" : at > 0 ? "Keep listening" : "Play it now"}
        </button>
        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
          <span className="block h-full rounded-full bg-coral-deep transition-[width]" style={{ width: `${done ? 100 : progress}%` }} />
        </span>
      </div>
      {(playing || at > 0) && !done && (
        <p className="rounded-2xl bg-ivory p-3 text-lg leading-snug" aria-live="polite">
          {sentences[at]}
        </p>
      )}
      {done && <p className="font-semibold">The end! It&apos;s on your kids&apos; bookshelves in Readli Kids too.</p>}
      {message && (
        <p role="status" className="text-sm font-semibold text-coral-deep">
          {message}
        </p>
      )}
    </div>
  );
}

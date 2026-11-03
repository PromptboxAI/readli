"use client";

import { useRef, useState } from "react";
import { parentPrimary } from "@/components/brand/buttons";
import { chapterReady, type Track } from "@/lib/player/tracks";
import { AHEAD, useGaplessAudio } from "./useGaplessAudio";
import { useTrackAudio } from "./useTrackAudio";

/**
 * Setup's Listen step: a small player under the book that reads it through, with the words showing. The
 * full player stays in Books; setup never leaves for it.
 *
 * A fully prepared chapter plays as one continuous track, so there is no pause between sentences. If the
 * track can't be had, it plays sentence by sentence with the next few sentences buffered ahead, as the
 * full player does.
 */
export function SetupMiniPlayer({
  slug,
  voiceId,
  revision,
  sentences,
  sentenceIds,
  chapters,
  ready,
}: {
  slug: string;
  voiceId: string;
  revision: string;
  sentences: string[];
  sentenceIds: string[];
  /** The chapter each sentence belongs to. */
  chapters: number[];
  ready: boolean[];
}) {
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const atRef = useRef(0);
  const noTrack = useRef(new Set<number>());
  const failed = useRef<number | null>(null);
  const readyIds = sentenceIds.filter((_, i) => ready[i]);

  const moveTo = (i: number) => {
    atRef.current = i;
    setAt(i);
  };

  const nextReady = (from: number) => {
    for (let i = from; i < sentences.length; i++) if (ready[i]) return i;
    return -1;
  };

  const stop = (note: string | null = null) => {
    audio.pause();
    track.pause();
    setPlaying(false);
    setLoading(false);
    if (note) setMessage(note);
  };

  const finish = () => {
    stop();
    audio.clear();
    track.clear();
    setDone(true);
    moveTo(0);
  };

  const audio = useGaplessAudio({
    ended: () => {
      failed.current = null;
      void playFrom(nextReady(atRef.current + 1));
    },
    error: (why) => onFailed(why),
  });

  const track = useTrackAudio({
    sentence: (i) => moveTo(i),
    ended: () => {
      // The track holds the whole chapter; carry on with the first sentence after it.
      const chapter = chapters[atRef.current];
      let last = atRef.current;
      while (last + 1 < chapters.length && chapters[last + 1] === chapter) last++;
      void playFrom(nextReady(last + 1));
    },
    error: (why) => {
      if (why instanceof DOMException && why.name === "AbortError") return;
      const chapter = chapters[atRef.current];
      if (chapter !== undefined) noTrack.current.add(chapter);
      track.clear();
      void playClip(atRef.current);
    },
  });

  const errorOf = async (res: Response | null) => {
    const body = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
    return body?.error?.message ?? "This story isn't available right now.";
  };

  const urlFor = async (i: number): Promise<string | null> => {
    const res = await fetch(`/api/family/books/${slug}/listen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voiceId, sentence: i, revision }),
    }).catch(() => null);
    if (!res?.ok) return null;
    return ((await res.json()) as { url: string }).url;
  };

  const started = () => {
    setPlaying(true);
    setLoading(false);
    setDone(false);
    setMessage(null);
  };

  const playFrom = async (i: number): Promise<void> => {
    if (i < 0) return finish();
    moveTo(i);
    const chapter = chapters[i];
    if (chapter !== undefined && !noTrack.current.has(chapter) && chapterReady({ sentenceIds, chapters }, readyIds, i)) return playTrack(i, chapter);
    return playClip(i);
  };

  /** The whole chapter as one recording, from sentence `i`. */
  const playTrack = async (i: number, chapter: number): Promise<void> => {
    const key = `${voiceId}:${revision}:${chapter}`;
    audio.pause();
    audio.clear();
    try {
      if (track.has(key, i)) {
        await track.seek(i);
      } else {
        setLoading(true);
        const res = await fetch(`/api/family/books/${slug}/listen/track`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ voiceId, chapter, revision }),
        }).catch(() => null);
        if (!res?.ok) {
          noTrack.current.add(chapter);
          return playClip(i);
        }
        await track.load(key, (await res.json()) as Track, i);
      }
      started();
    } catch (why) {
      if (why instanceof DOMException && why.name === "NotAllowedError") return stop("Tap play to start.");
      noTrack.current.add(chapter);
      track.clear();
      return playClip(i);
    }
  };

  /** One sentence, with the next few buffered so each starts the moment the one before ends. */
  const playClip = async (i: number): Promise<void> => {
    track.clear();
    const key = String(i);
    let url: string | null = null;
    if (!audio.buffered(key)) {
      audio.clear();
      setLoading(true);
      const res = await fetch(`/api/family/books/${slug}/listen`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voiceId, sentence: i, revision }),
      }).catch(() => null);
      if (!res?.ok) return stop(await errorOf(res));
      url = ((await res.json()) as { url: string }).url;
    }
    try {
      await audio.play(key, url);
      started();
      const upcoming: { key: string; url: () => Promise<string | null> }[] = [];
      for (let n = nextReady(i + 1); n >= 0 && upcoming.length < AHEAD; n = nextReady(n + 1)) {
        const s = n;
        upcoming.push({ key: String(s), url: () => urlFor(s) });
      }
      audio.preload(upcoming);
    } catch (why) {
      onFailed(why, i);
    }
  };

  /** A sentence that won't play is tried once more, then skipped, so one bad clip never stops the story. */
  const onFailed = (why: unknown, i = atRef.current) => {
    if (why instanceof DOMException && why.name === "AbortError") return;
    if (why instanceof DOMException && why.name === "NotAllowedError") return stop("Tap play to start.");
    audio.clear();
    if (failed.current !== i) {
      failed.current = i;
      void playClip(i);
    } else {
      failed.current = null;
      void playFrom(nextReady(i + 1));
    }
  };

  const toggle = () => {
    if (playing) return stop();
    // Lets the track's element play once its URL arrives, which phones only allow from a tap.
    track.unlock();
    void playFrom(done ? nextReady(0) : ready[atRef.current] ? atRef.current : nextReady(atRef.current));
  };

  const total = ready.filter(Boolean).length || 1;
  const progress = Math.round((ready.slice(0, at).filter(Boolean).length / total) * 100);

  return (
    <div className="flex w-full flex-col gap-3" data-testid="setup-mini-player">
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

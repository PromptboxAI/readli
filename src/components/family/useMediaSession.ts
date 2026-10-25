"use client";

import { useEffect, useRef } from "react";

type Actions = {
  play: () => void;
  pause: () => void;
  previous: () => void;
  next: () => void;
  /** Moves by this many seconds (negative goes back). */
  skip: (seconds: number) => void;
  /** Moves to this many seconds into the chapter; absent when the lock screen shouldn't offer scrubbing. */
  seekTo?: (seconds: number) => void;
};

type Position = { duration: number; position: number; playbackRate: number } | null;

const SKIP_SECONDS = 15;

/**
 * Shows the story on the lock screen, in the notification shade, on headphones and in the car: the
 * book, who is reading and the cover, with play/pause, back and forward 15 seconds, and previous and
 * next sentence, just like the player's own buttons. `position` gives the chapter's progress bar while
 * a chapter track plays. Browsers without Media Session simply don't show it.
 */
export function useMediaSession(
  meta: { title: string; narrator: string | null; coverUrl: string | null },
  playing: boolean,
  /** The sentence being heard; the progress bar is refreshed when it changes. */
  at: number,
  actions: Actions,
  position: () => Position,
) {
  const on = useRef(actions);
  on.current = actions;
  const where = useRef(position);
  where.current = position;
  const supported = typeof navigator !== "undefined" && "mediaSession" in navigator;

  useEffect(() => {
    if (!supported) return;
    const artwork = meta.coverUrl ? [{ src: new URL(meta.coverUrl, window.location.href).href, sizes: "600x800", type: meta.coverUrl.endsWith(".png") ? "image/png" : "image/webp" }] : [];
    navigator.mediaSession.metadata = new MediaMetadata({ title: meta.title, artist: meta.narrator ? `Read by ${meta.narrator}` : "Readli", album: "Readli", artwork });
  }, [supported, meta.title, meta.narrator, meta.coverUrl]);

  useEffect(() => {
    if (!supported) return;
    const ms = navigator.mediaSession;
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // This browser doesn't offer that button.
      }
    };
    set("play", () => on.current.play());
    set("pause", () => on.current.pause());
    set("stop", () => on.current.pause());
    set("previoustrack", () => on.current.previous());
    set("nexttrack", () => on.current.next());
    set("seekbackward", (d) => on.current.skip(-(d.seekOffset ?? SKIP_SECONDS)));
    set("seekforward", (d) => on.current.skip(d.seekOffset ?? SKIP_SECONDS));
    set("seekto", (d) => d.seekTime !== undefined && on.current.seekTo?.(d.seekTime));
    return () => {
      for (const a of ["play", "pause", "stop", "previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"] as MediaSessionAction[]) set(a, null);
      ms.metadata = null;
    };
  }, [supported]);

  // The playing state and the chapter's progress bar, kept up to date while playing.
  useEffect(() => {
    if (!supported) return;
    const ms = navigator.mediaSession;
    ms.playbackState = playing ? "playing" : "paused";
    const update = () => {
      const p = where.current();
      try {
        ms.setPositionState(p ?? undefined);
      } catch {
        // A position the browser won't take (such as one past the end) is skipped.
      }
    };
    update();
    if (!playing) return;
    const id = window.setInterval(update, 5000);
    return () => window.clearInterval(id);
  }, [supported, playing, at]);
}

"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { sentenceAtTime, startOf, type Track } from "@/lib/player/tracks";

type Handlers = {
  /** The sentence being heard changed (by playing on, or by a seek). */
  sentence: (index: number) => void;
  /** The track played to its end. */
  ended: () => void;
  error: (why: unknown) => void;
  /** Called about every `TICK_MS` while playing, also in the background, for heartbeats and permission checks. */
  tick?: () => void;
  /** Called on every time update while playing, also in the background (several times a second). */
  time?: () => void;
  /** Something else paused the track: a phone call, Siri, another app's audio, headphones unplugged. */
  interrupted?: () => void;
  /** Something else started it again, such as a headphone button. */
  resumed?: () => void;
};

/** Pause and play events this soon after the player's own pause, play or load are the player's, not an interruption. */
const OWN_MS = 1000;

const TICK_MS = 45_000;

/** A moment of silence, played from the first tap so later tracks may start without one. */
const SILENCE = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";

/**
 * Plays chapter tracks in one audio element that lives as long as the player. Phones allow a page to
 * start audio from its own element once a tap has started it, and a single continuous recording keeps
 * playing with the screen locked, unlike a new element per sentence. The sentence on screen follows the
 * element's clock through the track's timing map.
 */
export function useTrackAudio(handlers: Handlers) {
  const on = useRef(handlers);
  on.current = handlers;
  const el = useRef<HTMLAudioElement | null>(null);
  const track = useRef<{ key: string; track: Track } | null>(null);
  const heard = useRef<number | null>(null);
  const lastTick = useRef(0);
  const frame = useRef<number | null>(null);
  const acted = useRef(0);
  const own = () => Date.now() - acted.current < OWN_MS;

  const follow = useCallback(() => {
    const a = el.current;
    const t = track.current;
    if (!a || !t) return;
    const at = sentenceAtTime(t.track, a.currentTime * 1000);
    if (at !== heard.current) {
      heard.current = at;
      on.current.sentence(at);
    }
    if (!a.paused) on.current.time?.();
    const now = Date.now();
    if (on.current.tick && !a.paused && now - lastTick.current >= TICK_MS) {
      lastTick.current = now;
      on.current.tick();
    }
  }, []);

  // While the page is on screen, follow every frame so the highlight changes with the voice; in the
  // background, the element's own timeupdate events keep the place.
  const watch = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const loop = () => {
      follow();
      frame.current = el.current && !el.current.paused ? requestAnimationFrame(loop) : null;
    };
    frame.current = requestAnimationFrame(loop);
  }, [follow]);

  const element = useCallback(() => {
    if (el.current) return el.current;
    const a = new Audio();
    a.preload = "auto";
    a.addEventListener("timeupdate", follow);
    a.addEventListener("seeked", follow);
    a.addEventListener("playing", watch);
    a.addEventListener("ended", () => {
      if (!track.current) return;
      follow();
      on.current.ended();
    });
    a.addEventListener("error", () => track.current && on.current.error(a.error));
    a.addEventListener("pause", () => {
      if (track.current && !a.ended && !own()) on.current.interrupted?.();
    });
    a.addEventListener("play", () => {
      if (track.current && !own()) on.current.resumed?.();
    });
    el.current = a;
    return a;
  }, [follow, watch]);

  /**
   * Call from the tap that starts listening, before anything is awaited: it lets this element play
   * later, after the track's URL has arrived.
   */
  const unlock = useCallback(() => {
    const a = element();
    if (a.src) return;
    acted.current = Date.now();
    a.src = SILENCE;
    void a.play().then(
      () => {
        if (a.src === SILENCE) a.pause();
      },
      () => {},
    );
  }, [element]);

  /** Whether `key`'s track is loaded and holds sentence `at`. */
  const has = useCallback((key: string, at: number) => track.current?.key === key && startOf(track.current.track, at) !== null, []);

  /** Plays `next` from sentence `at`. */
  const load = useCallback(
    async (key: string, next: Track, at: number) => {
      const a = element();
      acted.current = Date.now();
      track.current = { key, track: next };
      heard.current = null;
      lastTick.current = Date.now();
      // The URL's #t= starts it at the sentence; some browsers ignore that, so the start is set again once
      // the track's length is known.
      const from = (startOf(next, at) ?? 0) / 1000;
      a.addEventListener("loadedmetadata", () => Math.abs(a.currentTime - from) > 0.25 && (a.currentTime = from), { once: true });
      a.src = `${next.url}#t=${from.toFixed(3)}`;
      await a.play();
    },
    [element],
  );

  /** Moves to sentence `at` of the loaded track and plays from there. */
  const seek = useCallback(async (at: number) => {
    const a = el.current;
    const t = track.current;
    const ms = t ? startOf(t.track, at) : null;
    if (!a || ms === null) return false;
    acted.current = Date.now();
    a.currentTime = ms / 1000;
    await a.play();
    return true;
  }, []);

  const pause = useCallback(() => {
    acted.current = Date.now();
    el.current?.pause();
  }, []);

  /** Moves by `seconds` within the loaded track (negative goes back), as the lock screen's skip buttons do. */
  const skip = useCallback((seconds: number) => {
    const a = el.current;
    if (!a || !track.current) return false;
    acted.current = Date.now();
    a.currentTime = Math.max(0, Math.min(track.current.track.durationMs / 1000, a.currentTime + seconds));
    return true;
  }, []);

  /** Where playback is in the loaded track, for the lock screen's progress bar; null with no track. */
  const position = useCallback(() => {
    const a = el.current;
    const t = track.current;
    if (!a || !t) return null;
    return { duration: t.track.durationMs / 1000, position: Math.min(a.currentTime, t.track.durationMs / 1000), playbackRate: a.playbackRate || 1 };
  }, []);

  /** Forgets the loaded track, after a storyteller change or when sentence-by-sentence playback takes over. */
  const clear = useCallback(() => {
    const a = el.current;
    track.current = null;
    heard.current = null;
    acted.current = Date.now();
    if (!a || !a.src || a.src === SILENCE) return;
    a.pause();
    a.removeAttribute("src");
    a.load();
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      const a = el.current;
      track.current = null;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
    },
    [],
  );

  return useMemo(() => ({ unlock, has, load, seek, pause, skip, position, clear }), [unlock, has, load, seek, pause, skip, position, clear]);
}

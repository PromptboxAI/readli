"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

type Handlers = {
  ended: () => void;
  error: (why: unknown) => void;
  /** Something else paused the sentence playing: a phone call, Siri, another app's audio, headphones unplugged. */
  interrupted?: () => void;
};

/** A pause this soon after the player's own play or pause is the player's, not an interruption. */
const OWN_MS = 1000;

function make(url: string, rate: number) {
  const el = new Audio();
  el.preload = "auto";
  el.defaultPlaybackRate = rate;
  el.playbackRate = rate;
  el.src = url;
  return el;
}

function drop(el: HTMLAudioElement | null | undefined) {
  if (!el) return;
  el.onended = null;
  el.onerror = null;
  el.onpause = null;
  el.pause();
  el.removeAttribute("src");
  el.load();
}

/**
 * How many sentences are buffered ahead of the one playing. One was not enough: a short line such as
 * "Ha!" ends before the next sentence's audio arrives, and the listener hears the wait.
 */
export const AHEAD = 3;

/**
 * Plays a story sentence by sentence without a gap between sentences: while one sentence plays, the
 * next few sentences' audio is fetched and buffered in their own elements, so each starts the moment
 * the one before ends. Only one element plays at a time; a buffered sentence that fails is fetched
 * again on demand.
 */
export function useGaplessAudio(handlers: Handlers) {
  const current = useRef<HTMLAudioElement | null>(null);
  // Upcoming sentences by key: their element once the URL has arrived, null while it is being fetched.
  const ahead = useRef(new Map<string, HTMLAudioElement | null>());
  // Bumped by clear(), so a URL that arrives after a seek or a storyteller change is thrown away.
  const generation = useRef(0);
  const on = useRef(handlers);
  on.current = handlers;
  const waiting = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acted = useRef(0);
  const speed = useRef(1);

  const stopWaiting = useCallback(() => {
    if (waiting.current !== null) clearTimeout(waiting.current);
    waiting.current = null;
  }, []);

  const attach = useCallback((el: HTMLAudioElement) => {
    el.onended = () => on.current.ended();
    el.onerror = () => on.current.error(el.error);
    el.onpause = () => {
      if (current.current === el && !el.ended && Date.now() - acted.current >= OWN_MS) on.current.interrupted?.();
    };
    current.current = el;
  }, []);

  /** Plays this sentence: the buffered copy when it matches `key`, otherwise `url`. */
  const play = useCallback(
    async (key: string, url: string | null) => {
      acted.current = Date.now();
      const buffered = ahead.current.get(key) ?? null;
      ahead.current.delete(key);
      if (current.current !== buffered) drop(current.current);
      const el = buffered ?? (url ? make(url, speed.current) : null);
      if (!el) return false;
      el.playbackRate = speed.current;
      attach(el);
      await el.play();
      return true;
    },
    [attach],
  );

  /**
   * Buffers these upcoming sentences, in order, fetching each one's URL once. Anything buffered that is
   * no longer upcoming is dropped.
   */
  const preload = useCallback((upcoming: { key: string; url: () => Promise<string | null> }[]) => {
    const keys = new Set(upcoming.map((u) => u.key));
    for (const [key, el] of ahead.current) {
      if (keys.has(key)) continue;
      drop(el);
      ahead.current.delete(key);
    }
    const at = generation.current;
    for (const { key, url } of upcoming) {
      if (ahead.current.has(key)) continue;
      ahead.current.set(key, null);
      void url()
        .catch(() => null)
        .then((u) => {
          if (generation.current !== at || ahead.current.get(key) !== null) return;
          if (!u) {
            ahead.current.delete(key);
            return;
          }
          const el = make(u, speed.current);
          el.onerror = () => {
            if (ahead.current.get(key) === el) ahead.current.delete(key);
          };
          el.load();
          ahead.current.set(key, el);
        });
    }
  }, []);

  const buffered = useCallback((key: string) => Boolean(ahead.current.get(key)), []);

  /** Runs `then` after a moment of silence, such as the pause before "The End.". Pausing or clearing cancels it. */
  const after = useCallback(
    (ms: number, then: () => void) => {
      stopWaiting();
      waiting.current = setTimeout(() => {
        waiting.current = null;
        then();
      }, ms);
    },
    [stopWaiting],
  );

  const pause = useCallback(() => {
    stopWaiting();
    acted.current = Date.now();
    current.current?.pause();
  }, [stopWaiting]);

  /** Sets the playback speed for the sentence playing and every one after it. */
  const rate = useCallback((r: number) => {
    speed.current = r;
    for (const el of [current.current, ...ahead.current.values()]) {
      if (!el) continue;
      el.defaultPlaybackRate = r;
      el.playbackRate = r;
    }
  }, []);

  /** Forgets the buffered sentences, after a seek or a storyteller change. */
  const clear = useCallback(() => {
    stopWaiting();
    generation.current += 1;
    for (const el of ahead.current.values()) drop(el);
    ahead.current.clear();
  }, [stopWaiting]);

  useEffect(
    () => () => {
      stopWaiting();
      drop(current.current);
      for (const el of ahead.current.values()) drop(el);
    },
    [stopWaiting],
  );

  return useMemo(() => ({ play, preload, buffered, after, pause, clear, rate }), [play, preload, buffered, after, pause, clear, rate]);
}

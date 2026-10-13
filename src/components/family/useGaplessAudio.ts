"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

type Handlers = { ended: () => void; error: () => void };

function make(url: string) {
  const el = new Audio();
  el.preload = "auto";
  el.src = url;
  return el;
}

function drop(el: HTMLAudioElement | null | undefined) {
  if (!el) return;
  el.onended = null;
  el.onerror = null;
  el.pause();
  el.removeAttribute("src");
  el.load();
}

/**
 * Plays a story sentence by sentence without a gap between sentences: while one sentence plays, the
 * next one's audio is fetched and buffered in a second element, so it starts the moment the first
 * ends. Only one element plays at a time; a buffered sentence that fails is fetched again on demand.
 */
export function useGaplessAudio(handlers: Handlers) {
  const current = useRef<HTMLAudioElement | null>(null);
  const next = useRef<{ key: string; el: HTMLAudioElement } | null>(null);
  const on = useRef(handlers);
  on.current = handlers;

  const attach = useCallback((el: HTMLAudioElement) => {
    el.onended = () => on.current.ended();
    el.onerror = () => on.current.error();
    current.current = el;
  }, []);

  /** Plays this sentence: the buffered copy when it matches `key`, otherwise `url`. */
  const play = useCallback(
    async (key: string, url: string | null) => {
      const buffered = next.current?.key === key ? next.current.el : null;
      next.current = null;
      if (current.current !== buffered) drop(current.current);
      const el = buffered ?? (url ? make(url) : null);
      if (!el) return false;
      attach(el);
      await el.play();
      return true;
    },
    [attach],
  );

  /** Buffers the sentence after this one. */
  const preload = useCallback(
    (key: string, url: string) => {
      if (next.current?.key === key) return;
      drop(next.current?.el);
      const el = make(url);
      el.onerror = () => {
        if (next.current?.el === el) next.current = null;
      };
      el.load();
      next.current = { key, el };
    },
    [],
  );

  const buffered = useCallback((key: string) => next.current?.key === key, []);

  const pause = useCallback(() => current.current?.pause(), []);

  /** Forgets the buffered sentence, after a seek or a storyteller change. */
  const clear = useCallback(() => {
    drop(next.current?.el);
    next.current = null;
  }, []);

  useEffect(
    () => () => {
      drop(current.current);
      drop(next.current?.el);
    },
    [],
  );

  return useMemo(() => ({ play, preload, buffered, pause, clear }), [play, preload, buffered, pause, clear]);
}

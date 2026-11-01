"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { endsChapter, nextSleep, type SleepMinutes } from "@/lib/player/pages";

type Sleep = { minutes: SleepMinutes; until: number | null };

const OFF: Sleep = { minutes: null, until: null };

/** "End of chapter" is kept across a reload for one evening, not carried into next week's story time. */
const CHAPTER_KEEP_MS = 12 * 60 * 60_000;

const NIGHT_NIGHT = "The sleep timer paused the story. Night night!";
const CHAPTER_DONE = "That's the end of the chapter. The sleep timer paused the story. Night night!";

/**
 * The players' sleep timer: 15, 30 or 45 minutes, or the end of the chapter. A minutes timer is a
 * deadline on the clock, kept on this device, so it holds across a reload and fires on time with the
 * screen locked: it is checked every second on screen, and with every update of the story's audio in
 * the background. "End of chapter" stops once the chapter's last sentence has been read, and leaves
 * the place at the start of the next chapter.
 */
export function useSleepTimer(storageKey: string, stop: () => void, notify: (message: string) => void) {
  const [sleep, setSleep] = useState<Sleep>(OFF);
  const [now, setNow] = useState(() => Date.now());
  const sleepRef = useRef(sleep);
  sleepRef.current = sleep;
  const on = useRef({ stop, notify });
  on.current = { stop, notify };

  const set = useCallback(
    (next: Sleep) => {
      setSleep(next);
      sleepRef.current = next;
      try {
        if (next.minutes === null) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, JSON.stringify({ ...next, setAt: Date.now() }));
      } catch {
        // Not kept across a reload this time.
      }
    },
    [storageKey],
  );

  /** Stops the story when a minutes timer has run out; true when it did. */
  const check = useCallback(() => {
    const { until } = sleepRef.current;
    const t = Date.now();
    setNow(t);
    if (until === null || t < until) return false;
    on.current.stop();
    set(OFF);
    on.current.notify(NIGHT_NIGHT);
    return true;
  }, [set]);

  /**
   * Call when sentence `at` has finished. True when "end of chapter" stopped the story there; the caller
   * then moves the place to the next sentence. At the end of the book the timer simply turns off.
   */
  const chapterEnd = useCallback(
    (chapters: readonly number[], at: number) => {
      if (sleepRef.current.minutes !== "chapter" || !endsChapter(chapters, at)) return false;
      set(OFF);
      if (at + 1 >= chapters.length) return false;
      on.current.stop();
      on.current.notify(CHAPTER_DONE);
      return true;
    },
    [set],
  );

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as (Sleep & { setAt?: number }) | null;
      const t = Date.now();
      if (saved?.minutes === "chapter" && t - (saved.setAt ?? 0) < CHAPTER_KEEP_MS) set({ minutes: "chapter", until: null });
      else if (saved && saved.until !== null && saved.until > t) set({ minutes: saved.minutes, until: saved.until });
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Storage can be blocked; the timer starts off.
    }
  }, [storageKey, set]);

  useEffect(() => {
    if (sleep.until === null) return;
    const id = window.setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [sleep.until, check]);

  /** Steps to the next setting; "end of chapter" is offered only when the book has more than one chapter. */
  const cycle = (hasChapters: boolean) => {
    const minutes = nextSleep(sleep.minutes, hasChapters);
    const t = Date.now();
    setNow(t);
    set({ minutes, until: typeof minutes === "number" ? t + minutes * 60_000 : null });
  };

  /** What the button shows: null when off, "Chapter", or the minutes left. */
  const label =
    sleep.minutes === null ? null : sleep.minutes === "chapter" ? "Chapter" : `${Math.max(1, Math.ceil(((sleep.until ?? now) - now) / 60_000))}m`;

  return { check, chapterEnd, cycle, label };
}

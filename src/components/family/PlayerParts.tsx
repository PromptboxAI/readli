"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { clock, pageCount, pageOf, pageRange, sentenceAt, timeline, type PlayerMode } from "@/lib/player/pages";

/** Pieces shared by the Readli Kids player and the grown-up player, so both look and behave alike. */

const ICONS = {
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none" />,
  left: <path d="M15 5l-7 7 7 7" />,
  down: <path d="M6 9l6 6 6-6" />,
  prev: (
    <>
      <path d="M19 5v14L9 12z" fill="currentColor" />
      <path d="M6 5v14" />
    </>
  ),
  next: (
    <>
      <path d="M5 5v14l10-7z" fill="currentColor" />
      <path d="M18 5v14" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" stroke="none" />,
  restart: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
};

export function Icon({ name, className = "size-6" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {ICONS[name]}
    </svg>
  );
}

/** Colors for the dark Listen mode and the light Read-along mode. */
export function playerTone(mode: PlayerMode) {
  const listen = mode === "listen";
  const soft = listen ? "bg-white/10" : "bg-ink/8";
  const faint = listen ? "text-night-muted" : "text-muted";
  return {
    listen,
    soft,
    faint,
    main: listen ? "bg-night text-night-ink" : "bg-ivory text-ink",
    round: `grid size-14 shrink-0 place-items-center rounded-full disabled:opacity-35 ${soft}`,
    side: `flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 font-display text-xs font-semibold whitespace-nowrap disabled:opacity-40 ${faint}`,
  };
}

/** The full-screen frame: one screen on a phone or iPad, nothing to scroll. */
export const PLAYER_MAIN = "flex h-dvh flex-col overflow-y-auto transition-colors";
export const PLAYER_COLUMN =
  "mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:px-10 sm:pt-[max(2.5rem,env(safe-area-inset-top))] sm:pb-[max(2.5rem,env(safe-area-inset-bottom))]";

export function ModeToggle({ mode, onChange }: { mode: PlayerMode; onChange: (mode: PlayerMode) => void }) {
  return (
    <div role="group" aria-label="Player mode" className={`flex min-w-0 flex-1 rounded-full p-1 font-display font-semibold sm:mx-auto sm:max-w-[340px] sm:text-lg ${playerTone(mode).soft}`}>
      {(["listen", "read"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
          className={`min-h-10 flex-1 rounded-full px-1 whitespace-nowrap ${mode === m ? "bg-sunshine text-ink" : "opacity-75"}`}
        >
          {m === "listen" ? "Just listen" : "Read along"}
        </button>
      ))}
    </div>
  );
}

/** Three small bars that bounce while a story plays. */
export function PlayingBars() {
  return (
    <span aria-hidden="true" className="flex h-4 w-[18px] items-end justify-center gap-0.5">
      <b className="h-[7px] w-[3px] rounded-sm bg-coral motion-safe:animate-pulse" />
      <b className="h-3.5 w-[3px] rounded-sm bg-coral motion-safe:animate-pulse" />
      <b className="h-2.5 w-[3px] rounded-sm bg-coral motion-safe:animate-pulse" />
    </span>
  );
}

/** An empty 3:4 box sized by the layout, so the whole cover always fits without cropping or scrolling. */
export function PlayerCover({ coverUrl, title, className }: { coverUrl: string | null; title: string; className: string }) {
  return (
    <div data-testid="player-cover" className={`relative grid aspect-[3/4] place-items-center overflow-hidden bg-bookcase ${className}`}>
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- static catalog cover art
        <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="p-3 text-center font-display text-muted">{title}</span>
      )}
    </div>
  );
}

/** Listen mode: the whole cover, the title and who is reading. */
export function ListenStage({ coverUrl, title, byline }: { coverUrl: string | null; title: string; byline: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
      <PlayerCover
        coverUrl={coverUrl}
        title={title}
        className="max-h-[470px] min-h-0 max-w-full flex-auto rounded-[22px] shadow-[0_10px_30px_rgb(0_0_0/0.3)] sm:max-h-[720px] sm:rounded-[28px]"
      />
      <div className="flex flex-col items-center gap-1.5">
        <h1 className="font-display text-[26px] leading-tight font-semibold text-balance sm:text-4xl">{title}</h1>
        {byline}
      </div>
    </section>
  );
}

/**
 * Read-along mode: a small cover, the title, and the current page with the sentence being read
 * highlighted. The page always fits its card: the words get smaller, a step at a time, before anything
 * scrolls.
 */
export function ReadStage({
  coverUrl,
  title,
  byline,
  sentences,
  sentence,
}: {
  coverUrl: string | null;
  title: string;
  byline: ReactNode;
  sentences: string[];
  sentence: number;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [first, last] = pageRange(pageOf(sentence), sentences.length);
  useLayoutEffect(() => {
    const box = card.current;
    if (!box) return;
    const fit = () => {
      let scale = 1;
      box.style.setProperty("--fit", "1");
      while (scale > 0.5 && box.scrollHeight > box.clientHeight) {
        scale -= 0.05;
        box.style.setProperty("--fit", scale.toFixed(2));
      }
    };
    fit();
    void document.fonts.ready.then(fit);
    const watch = new ResizeObserver(fit);
    watch.observe(box);
    return () => watch.disconnect();
  }, [first, sentences]);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <PlayerCover
          coverUrl={coverUrl}
          title={title}
          className="w-[84px] shrink-0 rounded-xl shadow-[0_4px_12px_rgb(40_53_72/0.2)] sm:w-[110px] tall:w-[150px] tall:rounded-[18px]"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-[22px] leading-tight font-semibold text-balance sm:text-3xl">{title}</h1>
          {byline}
        </div>
      </div>
      <div
        ref={card}
        data-testid="read-page"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl bg-surface p-[22px] ring-2 ring-ink/8 ring-inset sm:p-8 tall:rounded-[32px] tall:p-12"
      >
        <p className="my-auto font-display text-[length:calc(21px*var(--fit,1))] leading-[1.4] font-medium text-pretty sm:text-[length:calc(27px*var(--fit,1))] tall:text-[length:calc(34px*var(--fit,1))]">
          {sentences.slice(first, last).map((s, k) => {
            const i = first + k;
            return (
              <span
                key={i}
                data-current={i === sentence || undefined}
                className={i === sentence ? "box-decoration-clone rounded-md bg-sunshine/80 px-0.5 text-ink" : "text-ink/45"}
              >
                {s}{" "}
              </span>
            );
          })}
        </p>
      </div>
    </section>
  );
}

/**
 * A draggable time bar like an audiobook app's, with time listened, time left and "Page x of y".
 * Times are estimated from each sentence's length; the bar moves on through a sentence while it plays,
 * and letting go jumps to the sentence under it.
 */
export function TimeBar({
  mode,
  seconds,
  sentence,
  playing,
  onSeek,
}: {
  mode: PlayerMode;
  seconds: number[];
  sentence: number;
  playing: boolean;
  onSeek: (sentence: number) => void;
}) {
  const [spent, setSpent] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const sentenceRef = useRef(sentence);
  sentenceRef.current = sentence;

  useEffect(() => {
    setSpent(0);
  }, [sentence, playing]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setSpent((t) => Math.min(t + 1, seconds[sentenceRef.current] ?? 0)), 1000);
    return () => window.clearInterval(id);
  }, [playing, seconds]);

  const { listen, faint } = playerTone(mode);
  const starts = timeline(seconds);
  const total = starts[starts.length - 1] ?? 0;
  const elapsed = scrub ?? Math.min(total, (starts[sentence] ?? 0) + spent);
  const pages = pageCount(seconds.length);
  const shownPage = scrub === null ? pageOf(sentence) : pageOf(sentenceAt(starts, scrub));
  const percent = total ? (elapsed / total) * 100 : 0;

  const commit = () => {
    if (scrub === null) return;
    const at = sentenceAt(starts, scrub);
    setScrub(null);
    if (at !== sentence) onSeek(at);
  };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col">
      <div className="relative flex h-8 items-center rounded-full has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sunshine">
        <div aria-hidden="true" className={`relative h-1.5 w-full rounded-full ${listen ? "bg-white/20" : "bg-ink/15"}`}>
          <i className="absolute inset-y-0 left-0 rounded-full bg-coral" style={{ width: `${percent}%` }} />
          <b className="absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-coral shadow-[0_0_0_4px_rgb(255_121_103/0.25)]" style={{ left: `${percent}%` }} />
        </div>
        <input
          type="range"
          aria-label="Story time"
          aria-valuetext={`${clock(elapsed)} of ${clock(total)}, page ${shownPage + 1} of ${pages}`}
          min={0}
          max={total}
          step={1}
          value={Math.round(elapsed)}
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </div>
      <div className={`flex justify-between text-sm font-bold tabular-nums ${faint}`}>
        <span>{clock(elapsed)}</span>
        <span data-testid="player-page" className="font-semibold">
          Page {shownPage + 1} of {pages}
        </span>
        <span>&minus;{clock(total - elapsed)}</span>
      </div>
    </div>
  );
}

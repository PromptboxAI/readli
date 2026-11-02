"use client";

import { useEffect, useRef, useState } from "react";

/** Kevin's own Readli voice reading page 1, trimmed from his screen recording (2026-10-23). */
export const SAMPLE_SRC = "/samples/grandpa-kevin-billy-goats-gruff.mp3";

/**
 * Play button for a real Readli sample: by default Grandpa Kevin reading page 1 of Billy Goats Gruff
 * (homepage journey and /grandparents); book pages pass their own opening and narrator.
 */
export function SamplePlayer({
  title = "Billy Goats Gruff, page 1",
  large = false,
  src = SAMPLE_SRC,
  narrator = "Grandpa Kevin",
  length = "0:29",
}: {
  title?: string;
  large?: boolean;
  src?: string;
  narrator?: string;
  /** Shown before the audio loads; the real length replaces it once known. */
  length?: string | null;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(length);
  useEffect(() => {
    const a = audio.current;
    return () => a?.pause();
  }, []);
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-ivory ring-1 ring-ink/10 ${large ? "p-3.5" : "p-2.5"}`}>
      <audio
        ref={audio}
        src={src}
        preload={length ? "none" : "metadata"}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setShown(`${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, "0")}`);
        }}
      />
      <button
        type="button"
        onClick={() => {
          const a = audio.current;
          if (!a) return;
          if (a.paused) {
            void a
              .play()
              .then(() => setPlaying(true))
              .catch(() => setPlaying(false));
          } else {
            a.pause();
            setPlaying(false);
          }
        }}
        className={`grid shrink-0 place-items-center rounded-full bg-coral-deep text-white ${large ? "size-14 text-xl" : "size-11"}`}
        aria-label={playing ? `Pause ${narrator}'s sample` : `Play ${narrator}'s sample`}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <span className={`min-w-0 ${large ? "text-base" : "text-sm"}`}>
        <span className="block font-semibold">{title}</span>
        <span className="block text-muted">
          Read by {narrator}
          {shown ? ` · ${shown}` : ""}
        </span>
      </span>
    </div>
  );
}

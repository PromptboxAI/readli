"use client";

import { useEffect, useRef, useState } from "react";

/** Kevin's own Readli voice reading page 1, trimmed from his screen recording (2026-10-23). */
export const SAMPLE_SRC = "/samples/grandpa-kevin-billy-goats-gruff.mp3";

/** Play button for Grandpa Kevin's real Readli sample. Used on the homepage journey and /grandparents. */
export function SamplePlayer({ title = "Billy Goats Gruff, page 1", large = false }: { title?: string; large?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const a = audio.current;
    return () => a?.pause();
  }, []);
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-ivory ring-1 ring-ink/10 ${large ? "p-3.5" : "p-2.5"}`}>
      <audio ref={audio} src={SAMPLE_SRC} preload="none" onEnded={() => setPlaying(false)} />
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
        aria-label={playing ? "Pause Grandpa Kevin's sample" : "Play Grandpa Kevin's sample"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <span className={`min-w-0 ${large ? "text-base" : "text-sm"}`}>
        <span className="block font-semibold">{title}</span>
        <span className="block text-muted">Read by Grandpa Kevin · 0:29</span>
      </span>
    </div>
  );
}

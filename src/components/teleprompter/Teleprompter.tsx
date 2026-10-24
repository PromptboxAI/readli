"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { splitSentences, type VoiceScriptVersion } from "@/lib/content/voice-scripts";
import {
  activeIndex,
  READING_LINE,
  remainingSeconds,
  scrollDelta,
  scrollToText,
  textHeight,
  textToScroll,
  type TextBlock,
} from "@/lib/teleprompter/scroll";

/** How long auto-scroll waits after the reader touches, drags or wheels the text. */
const HOLD_AFTER_INTERACTION_MS = 1500;

interface Sentence {
  text: string;
  paragraph: number;
  words: number;
}

export interface TeleprompterProgress {
  activeSentence: number;
  remainingSeconds: number;
}

interface TeleprompterProps {
  script: VoiceScriptVersion;
  /** True only while capture is running and auto-scroll is on. */
  autoScroll: boolean;
  wpm: number;
  fontSizePx: number;
  /** Changing this resets the scroll to the top (Start over). */
  resetKey: number;
  onProgress?: (progress: TeleprompterProgress) => void;
}

export function Teleprompter({ script, autoScroll, wpm, fontSizePx, resetKey, onProgress }: TeleprompterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const sentenceRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const topsRef = useRef<number[]>([]);
  const holdUntilRef = useRef(0);
  const [active, setActive] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const leadIn = Math.round(viewportHeight * READING_LINE);

  const sentences = useMemo<Sentence[]>(
    () =>
      script.paragraphs.flatMap((p, paragraph) =>
        splitSentences(p).map((text) => ({ text, paragraph, words: text.split(/\s+/).filter(Boolean).length })),
      ),
    [script],
  );
  const totalWords = useMemo(() => sentences.reduce((n, s) => n + s.words, 0), [sentences]);
  // wordsFrom[i] = words from sentence i to the end.
  const wordsFrom = useMemo(() => {
    const out: number[] = new Array(sentences.length + 1).fill(0);
    for (let i = sentences.length - 1; i >= 0; i--) out[i] = (out[i + 1] ?? 0) + (sentences[i]?.words ?? 0);
    return out;
  }, [sentences]);

  // Sentence tops in scroll coordinates (offsetTop is relative to the text block).
  const measure = useCallback(() => {
    topsRef.current = sentenceRefs.current.map((el) => (el?.offsetTop ?? 0) + leadIn);
  }, [leadIn]);

  const updateActive = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const index = activeIndex(topsRef.current, el.scrollTop, el.clientHeight);
    setActive(index);
  }, []);

  useEffect(() => {
    onProgress?.({ activeSentence: active, remainingSeconds: remainingSeconds(wordsFrom[active] ?? 0, wpm) });
  }, [active, wpm, wordsFrom, onProgress]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    observer.observe(el);
    setViewportHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  // Re-measure when layout-affecting inputs change (font size, width, orientation).
  useEffect(() => {
    measure();
    updateActive();
  }, [fontSizePx, sentences, viewportHeight, measure, updateActive]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = 0;
    holdUntilRef.current = 0;
  }, [resetKey]);

  // Auto-scroll loop. Runs independently of audio capture.
  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (!el) return;
    // Paragraph boxes, re-read each frame so font size and width changes apply mid-take.
    const blocks = (): TextBlock[] =>
      paragraphRefs.current.flatMap((p) => (p ? [{ top: p.offsetTop, height: p.offsetHeight }] : []));
    let frame = 0;
    let last = performance.now();
    // Position along the text with paragraph gaps removed, so the gaps take no reading time.
    let position = scrollToText(blocks(), el.scrollTop);
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      const b = blocks();
      if (now < holdUntilRef.current) {
        position = scrollToText(b, el.scrollTop);
      } else {
        const pxPerWord = textHeight(b) / Math.max(1, totalWords);
        position += scrollDelta(wpm, pxPerWord, dt);
        el.scrollTop = textToScroll(b, position);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [autoScroll, wpm, totalWords]);

  const hold = () => {
    holdUntilRef.current = performance.now() + HOLD_AFTER_INTERACTION_MS;
  };

  return (
    <div className="relative h-full min-h-0">
      <div
        ref={containerRef}
        data-testid="teleprompter"
        tabIndex={0}
        role="region"
        aria-label="Recording script. Scrolls automatically while recording; you can drag or use arrow keys to move it."
        onScroll={updateActive}
        onPointerDown={hold}
        onWheel={hold}
        onTouchStart={hold}
        onKeyDown={(e) => {
          if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) hold();
        }}
        style={{ overflowAnchor: "none" }}
        className="h-full overflow-y-auto overscroll-contain rounded-[var(--radius-panel)] bg-surface px-5 sm:px-10"
      >
        <div style={{ paddingTop: leadIn, paddingBottom: viewportHeight }}>
          <div ref={textRef} className="relative mx-auto max-w-3xl" style={{ fontSize: fontSizePx, lineHeight: 1.5 }}>
            {script.paragraphs.map((_, p) => (
              <p
                key={p}
                ref={(node) => {
                  paragraphRefs.current[p] = node;
                }}
                className="mb-[0.9em] font-semibold"
              >
                {sentences.map((s, i) =>
                  s.paragraph === p ? (
                    <span
                      key={i}
                      ref={(node) => {
                        sentenceRefs.current[i] = node;
                      }}
                      data-active={i === active || undefined}
                      className={
                        i === active
                          ? "rounded-md bg-sunshine/45 text-ink transition-colors duration-500 ease-out"
                          : "text-ink/45 transition-colors duration-500 ease-out"
                      }
                    >
                      {s.text}{" "}
                    </span>
                  ) : null,
                )}
              </p>
            ))}
          </div>
        </div>
      </div>
      {/* Reading-line marker */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 flex items-center"
        style={{ top: `${READING_LINE * 100}%` }}
      >
        <span className="h-0 w-0 border-y-[10px] border-l-[14px] border-y-transparent border-l-coral-deep" />
      </div>
    </div>
  );
}

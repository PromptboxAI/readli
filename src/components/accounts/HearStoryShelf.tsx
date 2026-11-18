"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DemoBookShelf } from "@/components/books/DemoBookShelf";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary } from "@/components/brand/buttons";
import type { DemoBook } from "@/lib/content/demo-books";

interface Played {
  book: DemoBook;
  url: string;
  standIn: boolean;
}

/**
 * The /try bookshelf for a signed-in grown-up: pick one of the demo books and hear its opening read in
 * their own saved voice. A story heard once replays from this page without asking again. Like everywhere
 * else in Readli, nothing plays until they tap.
 */
export function HearStoryShelf({
  ready,
  texts = {},
  next,
  scrollTo,
}: {
  ready: boolean;
  /** What each book reads, for the read-along. */
  texts?: Record<string, string>;
  /** Inside a walkthrough: the way on, repeated right under the player once a story plays, so nobody has to scroll for it. */
  next?: { href: string; label: string };
  /** The id of the heading to bring back into view when a story is picked; the page's h1 by default. */
  scrollTo?: string;
}) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<Played | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heard = useRef(new Map<string, Played>());
  const [explored, setExplored] = useState<ReadonlySet<string>>(new Set());
  const topRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => heard.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  // Picking a story from the shelf brings the step's heading and the player back into view: once on the tap,
  // and again when the player has replaced the loader, since its height changes the page.
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    if (!asked) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = (scrollTo ? document.getElementById(scrollTo) : document.querySelector("h1")) ?? topRef.current;
    target?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }, [asked, loading, playing, scrollTo]);

  const hear = async (book: DemoBook) => {
    setError(null);
    setActiveSlug(book.slug);
    setAsked((n) => n + 1);
    const already = heard.current.get(book.slug);
    if (already) {
      setPlaying({ ...already });
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/voice/sample?book=${encodeURIComponent(book.slug)}`, { method: "POST" }).catch(() => null);
    setLoading(false);
    if (!res?.ok) {
      setError((await res?.json().catch(() => null))?.error?.message ?? "We couldn't read that story just now. Please try again.");
      setActiveSlug(playing?.book.slug ?? null);
      return;
    }
    const played: Played = { book, url: URL.createObjectURL(await res.blob()), standIn: res.headers.get("x-readli-stand-in") === "1" };
    heard.current.set(book.slug, played);
    setExplored(new Set(heard.current.keys()));
    setPlaying(played);
  };

  return (
    <div ref={topRef} className="flex scroll-mt-4 flex-col gap-5" data-testid="hear-story-shelf">
      {loading && (
        <div role="status" className="flex items-center gap-4 rounded-[var(--radius-panel)] bg-sky/40 p-5">
          <ReadiMascot state="listening" size={80} decorative className="shrink-0" />
          <p className="font-display text-xl font-semibold">Reading the story in your voice…</p>
        </div>
      )}
      {playing && !loading && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-plum p-5 text-white sm:flex-row sm:items-center" data-testid="story-player">
          <ReadiMascot state="listening" size={110} decorative className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-display text-xl font-semibold">{playing.book.title} · read by you</p>
            <audio key={playing.url} controls autoPlay src={playing.url} className="w-full" aria-label={`${playing.book.title}, read in your voice`} />
            {playing.standIn && <p className="rounded-xl bg-sunshine px-3 py-2 text-sm font-semibold text-ink">Test mode: this is a stand-in sound, not your voice.</p>}
            <details className="text-sm text-white/85">
              <summary className="cursor-pointer font-semibold">Read along</summary>
              <p className="mt-2 leading-relaxed">{texts[playing.book.slug] ?? playing.book.passageText}</p>
            </details>
          </div>
        </div>
      )}
      {playing && !loading && next && (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4" data-testid="story-next">
          <Link href={next.href} className={`${buttonPrimary} w-full sm:w-auto`}>
            {next.label}
          </Link>
          <button
            type="button"
            className="min-h-11 font-display font-semibold underline underline-offset-4"
            onClick={() => shelfRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })}
          >
            or pick another story
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-2xl border-[3px] border-coral-deep bg-surface p-4 font-semibold">
          {error}
        </p>
      )}
      <div ref={shelfRef} className="scroll-mt-4">
        <DemoBookShelf
          heading={playing ? "Pick another story" : "Pick a story to hear in your voice"}
          // The same first story family setup prepares.
          first="the-lion-and-the-mouse"
          onHear={(book) => void hear(book)}
          activeSlug={playing && !loading ? activeSlug : null}
          busy={loading}
          explored={explored}
          disabledReason={ready ? null : "Your voice is still being made. Refresh in a minute."}
        />
      </div>
    </div>
  );
}

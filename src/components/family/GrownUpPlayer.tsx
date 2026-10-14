"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import type { ListenView } from "@/lib/narration/narration";
import { StorytellerAvatar } from "./StorytellerAvatar";
import { useGaplessAudio } from "./useGaplessAudio";

/**
 * The Parent Portal player: plays a prepared book sentence by sentence from stored audio, in any
 * voice the family may use, and stops where the prepared audio ends instead of generating more.
 */
export function GrownUpPlayer({ view, initialVoice }: { view: ListenView; initialVoice: string | null }) {
  const { book, sentences, sentenceIds, voices } = view;
  const [voiceId, setVoiceId] = useState(initialVoice);
  const [sentence, setSentence] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const voiceRef = useRef(voiceId);
  voiceRef.current = voiceId;
  const sentenceRef = useRef(sentence);
  sentenceRef.current = sentence;
  const audio = useGaplessAudio({ ended: () => onEnded(), error: () => stop() });

  const voice = voices.find((v) => v.voiceId === voiceId) ?? null;
  const readyAt = (id: string | null, at: number) => Boolean(id && voices.find((v) => v.voiceId === id)?.readySentenceIds.includes(sentenceIds[at] ?? ""));

  const stop = () => {
    audio.pause();
    setPlaying(false);
    setLoading(false);
  };

  /** A signed URL for one prepared sentence; the server re-checks plan, share and slot each time. */
  const fetchUrl = (at: number, id: string) =>
    fetch(`/api/family/books/${book.slug}/listen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voiceId: id, sentence: at }),
    });

  /** Buffers the next sentence while this one plays, so the story flows without a pause. */
  const prefetch = async (at: number, id: string) => {
    if (at >= sentences.length || !readyAt(id, at)) return;
    const res = await fetchUrl(at, id).catch(() => null);
    if (!res?.ok || voiceRef.current !== id) return;
    const { url } = (await res.json()) as { url: string };
    audio.preload(`${id}:${at}`, url);
  };

  const play = async (at: number, id: string) => {
    setNotice(null);
    if (!readyAt(id, at)) {
      stop();
      setNotice(`${voices.find((v) => v.voiceId === id)?.name ?? "This storyteller"}'s reading isn't prepared here yet.`);
      return;
    }
    const key = `${id}:${at}`;
    let url: string | null = null;
    if (!audio.buffered(key)) {
      audio.clear();
      setLoading(true);
      const res = await fetchUrl(at, id);
      if (voiceRef.current !== id) return;
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        stop();
        setNotice(body?.error?.message ?? "This story isn't available right now.");
        return;
      }
      url = ((await res.json()) as { url: string }).url;
    }
    try {
      await audio.play(key, url);
      setPlaying(true);
      setLoading(false);
      void prefetch(at + 1, id);
    } catch {
      stop();
    }
  };

  const onEnded = () => {
    const next = sentenceRef.current + 1;
    const id = voiceRef.current;
    if (next >= sentences.length || !id) return stop();
    setSentence(next);
    sentenceRef.current = next;
    if (readyAt(id, next)) void play(next, id);
    else {
      stop();
      setNotice(`${voices.find((v) => v.voiceId === id)?.name ?? "This storyteller"}'s reading stops here for now. Prepare the rest of the book to keep listening.`);
    }
  };

  const goTo = (at: number) => {
    audio.clear();
    setSentence(at);
    if ((playing || loading) && voiceId) void play(at, voiceId);
  };

  const choose = (id: string) => {
    audio.clear();
    setVoiceId(id);
    voiceRef.current = id;
    if (playing || loading) void play(sentence, id);
  };

  return (
    <div className="flex flex-col gap-6" data-testid="grown-up-player">
      <Link href="/family/books" className="self-start font-semibold underline underline-offset-4">
        ← Books
      </Link>
      <div className="flex flex-wrap items-center gap-5">
        {book.coverUrl ? (
          <Image src={book.coverUrl} alt="" width={120} height={180} className="h-44 w-auto rounded-2xl shadow-md" />
        ) : (
          <div className={`flex h-44 w-28 items-center justify-center rounded-2xl ${book.tint}`} aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-semibold">{book.title}</h1>
          <p className="text-lg text-muted">{book.author}</p>
        </div>
      </div>

      {voices.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10" data-testid="nothing-prepared">
          <p className="text-lg font-semibold">This book isn&apos;t prepared in a family voice yet.</p>
          <Link href={`/family/books/${book.slug}`} className={`${buttonPrimary} self-start`}>
            Prepare narration
          </Link>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Storyteller" className="flex flex-wrap gap-3">
            {voices.map((v) => (
              <button
                key={v.voiceId}
                type="button"
                aria-pressed={v.voiceId === voiceId}
                onClick={() => choose(v.voiceId)}
                className={`flex items-center gap-3 rounded-full py-1 pl-1 pr-4 font-semibold ${v.voiceId === voiceId ? "bg-sunshine" : "bg-surface ring-2 ring-ink/10"}`}
              >
                <StorytellerAvatar name={v.name} avatarUrl={v.avatarUrl} tint={v.tint} size="sm" />
                <span>
                  {v.name}
                  <span className="block text-xs font-bold text-muted">{v.complete ? "Whole book ready" : `${v.readySentenceIds.length} of ${sentences.length} sentences ready`}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={buttonSecondary} disabled={sentence === 0} onClick={() => goTo(sentence - 1)}>
              Back
            </button>
            <button
              type="button"
              className={buttonPrimary}
              disabled={!voiceId || (!playing && !readyAt(voiceId, sentence))}
              onClick={() => (playing ? stop() : voiceId && play(sentence, voiceId))}
            >
              {playing ? "Pause" : loading ? "Getting ready…" : "Play"}
            </button>
            <button type="button" className={buttonSecondary} disabled={sentence + 1 >= sentences.length} onClick={() => goTo(sentence + 1)}>
              Next
            </button>
            <span className="text-sm text-muted" data-testid="sentence-position">
              Sentence {sentence + 1} of {sentences.length}
            </span>
          </div>

          {voice && !voice.complete && (
            <p className="text-sm">
              {voice.name}&apos;s reading covers {voice.readySentenceIds.length} of {sentences.length} sentences.{" "}
              <Link href={`/family/books/${book.slug}`} className="font-semibold underline underline-offset-4">
                Prepare the rest
              </Link>
            </p>
          )}
          {notice && (
            <p role="alert" className="rounded-2xl border-[3px] border-coral-deep bg-surface p-4 font-semibold">
              {notice}
            </p>
          )}

          <article aria-label={book.title} className="rounded-panel bg-surface p-6 text-xl leading-relaxed ring-2 ring-ink/10 sm:p-8">
            {sentences.map((s, i) => (
              <span key={i} data-current={i === sentence || undefined} className={i === sentence ? "rounded bg-sunshine/70" : ""}>
                {s}{" "}
              </span>
            ))}
          </article>
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import type { NarratorView } from "@/lib/family/service";
import { StorytellerAvatar } from "./StorytellerAvatar";

const REFRESH_MS = 10_000;

/**
 * Readli Kids player (Amendment 002 §3). Shows only narrators the server says this child may hear,
 * switches narrator at the current sentence, and stops straight away if a voice is revoked.
 */
export function KidsPlayer({
  childId,
  childName,
  book,
  sentences,
  initialNarrators,
  resume,
}: {
  childId: string;
  childName: string;
  book: { slug: string; title: string };
  sentences: string[];
  initialNarrators: NarratorView[];
  /** This child's saved place and narrator in this book. */
  resume: { sentence: number; voiceId: string | null };
}) {
  const [narrators, setNarrators] = useState(initialNarrators);
  const [voiceId, setVoiceId] = useState<string | null>(
    initialNarrators.find((n) => n.voiceId === resume.voiceId)?.voiceId ?? initialNarrators[0]?.voiceId ?? null,
  );
  const [sentence, setSentence] = useState(Math.min(resume.sentence, sentences.length - 1));
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [standIn, setStandIn] = useState(false);
  const [picker, setPicker] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const voiceRef = useRef(voiceId);
  voiceRef.current = voiceId;

  const listening = useRef(false);

  /** Ends this child's listening session so it stops counting against the family's limit. */
  const endSession = useCallback(() => {
    if (!listening.current) return;
    listening.current = false;
    void fetch(`/api/kids/${childId}/listening`, { method: "DELETE", keepalive: true });
  }, [childId]);

  const stop = () => {
    audio.current?.pause();
    setPlaying(false);
    setLoading(false);
    endSession();
  };

  useEffect(() => endSession, [endSession]);

  // Each child keeps their own place and narrator in every book.
  useEffect(() => {
    void fetch(`/api/kids/${childId}/progress`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookSlug: book.slug, sentence, voiceId }),
      keepalive: true,
    });
  }, [childId, book.slug, sentence, voiceId]);

  /** Asks the server who this child may hear; drops a narrator that is no longer allowed. */
  const refresh = useCallback(async (): Promise<NarratorView[] | null> => {
    const res = await fetch(`/api/kids/${childId}/narrators`, { cache: "no-store" });
    if (!res.ok) return null;
    const list = ((await res.json()) as { narrators: NarratorView[] }).narrators;
    setNarrators(list);
    const current = voiceRef.current;
    if (current && !list.some((n) => n.voiceId === current)) {
      audio.current?.pause();
      setPlaying(false);
      setLoading(false);
      endSession();
      setVoiceId(list[0]?.voiceId ?? null);
      setNotice(list.length ? "That storyteller isn't available right now. Pick another one." : null);
    } else if (!current && list[0]) {
      setVoiceId(list[0].voiceId);
    }
    return list;
  }, [childId, endSession]);

  useEffect(() => {
    const id = window.setInterval(refresh, REFRESH_MS);
    const onFocus = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const play = async (at: number, voice: string) => {
    setNotice(null);
    setLoading(true);
    // Counts against the family's concurrent stories; refreshed by each sentence request.
    const session = await fetch(`/api/kids/${childId}/listening`, { method: "POST" });
    if (!session.ok) {
      const body = (await session.json().catch(() => null)) as { error?: { message?: string } } | null;
      audio.current?.pause();
      setPlaying(false);
      setLoading(false);
      setNotice(body?.error?.message ?? "Story time isn't available right now.");
      return;
    }
    listening.current = true;
    const res = await fetch("/api/kids/narrations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId, voiceId: voice, bookSlug: book.slug, sentence: at }),
    });
    if (voiceRef.current !== voice) return; // switched again while waiting
    if (!res.ok) {
      stop();
      await refresh();
      setNotice("That storyteller isn't available right now. Pick another one.");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    const el = audio.current!;
    el.src = url;
    try {
      await el.play();
      setPlaying(true);
    } catch {
      stop();
    }
    setLoading(false);
  };

  const onAudioError = async () => {
    // The audio URL is re-checked on the server; a revoked voice fails here.
    stop();
    await refresh();
  };

  const onEnded = () => {
    if (sentence + 1 < sentences.length && voiceId) {
      setSentence(sentence + 1);
      void play(sentence + 1, voiceId);
    } else {
      setPlaying(false);
      endSession();
    }
  };

  const choose = (id: string) => {
    setPicker(false);
    setVoiceId(id);
    voiceRef.current = id;
    if (playing || loading) void play(sentence, id);
  };

  const goTo = (at: number) => {
    setSentence(at);
    if ((playing || loading) && voiceId) void play(at, voiceId);
  };

  const current = narrators.find((n) => n.voiceId === voiceId) ?? null;

  if (narrators.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-panel bg-surface p-8 text-center ring-2 ring-ink/10" data-testid="no-storytellers">
        <ReadiMascot size={160} decorative />
        <h2 className="font-display text-3xl font-semibold">No storytellers yet</h2>
        <p className="max-w-md text-lg">Ask a grown-up to choose who can read stories to you, {childName}.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="kids-player">
      <div className="flex flex-wrap items-center gap-4 rounded-panel bg-plum p-4 text-white">
        <button
          type="button"
          onClick={() => setPicker((p) => !p)}
          aria-expanded={picker}
          aria-controls="narrator-picker"
          className="flex items-center gap-3 rounded-full bg-white/10 py-1 pl-1 pr-5 text-left hover:bg-white/20"
        >
          {current && <StorytellerAvatar name={current.name} avatarUrl={current.avatarUrl} tint={current.tint} size="lg" />}
          <span>
            <span className="block text-sm text-white/80">Read by</span>
            <span className="block font-display text-2xl font-semibold" data-testid="current-narrator">
              {current?.name ?? "Pick a storyteller"}
            </span>
            <span className="block text-sm font-semibold text-sunshine">Change storyteller</span>
          </span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          {loading && <ReadiMascot state="listening" size={72} decorative className="motion-safe:animate-bob" />}
          <button
            type="button"
            disabled={!voiceId}
            onClick={() => (playing ? stop() : voiceId && play(sentence, voiceId))}
            className="min-h-14 rounded-full bg-sunshine px-6 font-display text-xl font-semibold text-ink disabled:opacity-50"
          >
            {playing ? "Pause" : loading ? "Getting ready…" : "Play"}
          </button>
        </div>
      </div>

      {picker && (
        <div id="narrator-picker" role="group" aria-label="Choose a storyteller" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {narrators.map((n) => (
            <button
              key={n.voiceId}
              type="button"
              aria-pressed={n.voiceId === voiceId}
              onClick={() => choose(n.voiceId)}
              className={`flex flex-col items-center gap-2 rounded-3xl p-3 ${n.voiceId === voiceId ? "bg-sunshine" : "bg-surface ring-2 ring-ink/10"}`}
            >
              <StorytellerAvatar name={n.name} avatarUrl={n.avatarUrl} tint={n.tint} size="lg" />
              <span className="font-display text-lg font-semibold">{n.name}</span>
            </button>
          ))}
        </div>
      )}

      {notice && (
        <p role="alert" className="rounded-2xl border-[3px] border-coral-deep bg-surface p-4 font-semibold">
          {notice}
        </p>
      )}

      <article aria-label={book.title} className="rounded-panel bg-surface p-6 text-xl leading-relaxed ring-2 ring-ink/10 sm:p-8 sm:text-2xl">
        {sentences.map((s, i) => (
          <span key={i} data-current={i === sentence || undefined} className={i === sentence ? "rounded bg-sunshine/70" : ""}>
            {s}{" "}
          </span>
        ))}
      </article>

      <div className="flex items-center justify-between gap-3">
        <button type="button" disabled={sentence === 0} onClick={() => goTo(sentence - 1)} className="min-h-12 rounded-full border-[3px] border-ink px-5 font-display font-semibold disabled:opacity-40">
          Back
        </button>
        <span className="text-sm text-muted" data-testid="sentence-position">
          Sentence {sentence + 1} of {sentences.length}
        </span>
        <button type="button" disabled={sentence + 1 >= sentences.length} onClick={() => goTo(sentence + 1)} className="min-h-12 rounded-full border-[3px] border-ink px-5 font-display font-semibold disabled:opacity-40">
          Next
        </button>
      </div>

      {standIn && (
        <p className="rounded-xl bg-sunshine px-3 py-2 text-sm font-semibold">Test mode: this is a stand-in sound, not the storyteller&apos;s voice.</p>
      )}
      {/* The full text is on screen as the reading page. */}
      <audio
        ref={audio}
        onEnded={onEnded}
        onError={onAudioError}
        onLoadedData={() => setStandIn(true)}
        className="hidden"
      />
    </div>
  );
}

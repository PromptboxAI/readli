"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import type { NarratorView } from "@/lib/family/service";
import type { KidsNarratorReadiness } from "@/lib/narration/narration";
import { StorytellerAvatar } from "./StorytellerAvatar";
import { useGaplessAudio } from "./useGaplessAudio";

const REFRESH_MS = 10_000;
const PAUSED = "Story time paused. Press Play to keep listening.";

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
  return body?.error?.code;
}

/**
 * Readli Kids player. Shows only narrators the server says this child may hear, marks which have
 * audio prepared at the current sentence, switches instantly at the current sentence when it is
 * prepared, and never generates audio while the child waits.
 */
export function KidsPlayer({
  childId,
  childName,
  book,
  sentences,
  sentenceIds,
  initialNarrators,
  initialReadiness,
  resume,
  preview = false,
}: {
  childId: string;
  childName: string;
  book: { slug: string; title: string };
  sentences: string[];
  sentenceIds: string[];
  initialNarrators: NarratorView[];
  initialReadiness: KidsNarratorReadiness[];
  /** This child's saved place and narrator in this book. */
  resume: { sentence: number; voiceId: string | null };
  /** The preview family, whose narration is a stand-in sound. */
  preview?: boolean;
}) {
  const [narrators, setNarrators] = useState(initialNarrators);
  const [readiness, setReadiness] = useState(initialReadiness);
  const [voiceId, setVoiceId] = useState<string | null>(
    initialNarrators.find((n) => n.voiceId === resume.voiceId)?.voiceId ?? initialNarrators[0]?.voiceId ?? null,
  );
  const [sentence, setSentence] = useState(Math.min(resume.sentence, sentences.length - 1));
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const voiceRef = useRef(voiceId);
  voiceRef.current = voiceId;
  const sentenceRef = useRef(sentence);
  sentenceRef.current = sentence;
  const listening = useRef(false);
  const audio = useGaplessAudio({ ended: () => onEnded(), error: () => void onAudioError() });

  const readyAt = (id: string | null, at: number) =>
    Boolean(id && readiness.find((r) => r.voiceId === id)?.readySentenceIds.includes(sentenceIds[at] ?? ""));

  /** Ends this child's listening session so it stops counting against the family's limit. */
  const endSession = useCallback(() => {
    if (!listening.current) return;
    listening.current = false;
    void fetch(`/api/kids/${childId}/listening`, { method: "DELETE", keepalive: true });
  }, [childId]);

  const halt = useCallback(() => {
    audio.pause();
    audio.clear();
    setPlaying(false);
    setLoading(false);
    endSession();
  }, [audio, endSession]);

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

  /** Asks the server who this child may hear and what is prepared; drops a narrator no longer allowed. */
  const refresh = useCallback(async () => {
    const res = await fetch(`/api/kids/${childId}/books/${book.slug}`, { cache: "no-store" }).catch(() => null);
    if (!res) return true;
    if (!res.ok) return true;
    const body = (await res.json()) as { narrators: NarratorView[]; readiness: KidsNarratorReadiness[] };
    setNarrators(body.narrators);
    setReadiness(body.readiness);
    const current = voiceRef.current;
    if (current && !body.narrators.some((n) => n.voiceId === current)) {
      halt();
      setVoiceId(body.narrators[0]?.voiceId ?? null);
      setNotice(body.narrators.length ? "That storyteller isn't available right now. Pick another one." : null);
      return false;
    }
    if (!current && body.narrators[0]) setVoiceId(body.narrators[0].voiceId);
    return true;
  }, [childId, book.slug, halt]);

  useEffect(() => {
    const id = window.setInterval(refresh, REFRESH_MS);
    const onFocus = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const nameOf = (id: string | null) => narrators.find((n) => n.voiceId === id)?.name ?? "This storyteller";

  /** A signed URL for one prepared sentence; every permission gate is checked on the server. */
  const fetchUrl = (at: number, voice: string) =>
    fetch("/api/kids/narrations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId, voiceId: voice, bookSlug: book.slug, sentence: at }),
    });

  /** Buffers the next sentence while this one plays, so the story flows without a pause. */
  const prefetch = async (at: number, voice: string) => {
    if (at >= sentences.length || !readyAt(voice, at)) return;
    const res = await fetchUrl(at, voice).catch(() => null);
    if (res && !res.ok && (await errorCode(res)) === "no_listening_session") listening.current = false;
    if (!res?.ok || voiceRef.current !== voice) return;
    const { url } = (await res.json()) as { url: string };
    audio.preload(`${voice}:${at}`, url);
  };

  /** Counts against the family's concurrent stories; refreshed by each sentence request. */
  const startSession = async () => {
    if (listening.current) return true;
    const session = await fetch(`/api/kids/${childId}/listening`, { method: "POST" }).catch(() => null);
    if (!session?.ok) {
      const body = (await session?.json().catch(() => null)) as { error?: { message?: string } } | null;
      halt();
      setNotice(body?.error?.message ?? "Story time isn't available right now.");
      return false;
    }
    listening.current = true;
    return true;
  };

  const play = async (at: number, voice: string) => {
    setNotice(null);
    const key = `${voice}:${at}`;
    let url: string | null = null;
    if (!audio.buffered(key) || !listening.current) {
      audio.clear();
      setLoading(true);
      if (!(await startSession())) return;
      let res = await fetchUrl(at, voice).catch(() => null);
      let code = res && !res.ok ? await errorCode(res) : undefined;
      if (code === "no_listening_session") {
        // The listening session lapsed while the page sat idle; start a fresh one and try again.
        listening.current = false;
        if (!(await startSession())) return;
        res = await fetchUrl(at, voice).catch(() => null);
        code = res && !res.ok ? await errorCode(res) : undefined;
      }
      if (voiceRef.current !== voice) return; // switched again while waiting
      if (!res?.ok) {
        halt();
        if (code === "not_prepared") {
          setNotice(`${nameOf(voice)}'s reading stops here for now. Pick another storyteller, or ask a grown-up to prepare more.`);
        } else if (code === "voice_not_available") {
          // refresh() drops the narrator and explains if access really was removed.
          if (await refresh()) setNotice(PAUSED);
        } else {
          setNotice(PAUSED);
        }
        return;
      }
      url = ((await res.json()) as { url: string }).url;
    }
    try {
      await audio.play(key, url);
      setPlaying(true);
      setLoading(false);
      void prefetch(at + 1, voice);
    } catch {
      halt();
    }
  };

  const onAudioError = async () => {
    // The audio URL is re-checked on the server; a revoked voice fails here.
    halt();
    await refresh();
  };

  const onEnded = () => {
    const at = sentenceRef.current;
    const voice = voiceRef.current;
    // Only continue into audio that is already prepared; never promise more than exists.
    if (at + 1 < sentences.length && voice && !readyAt(voice, at + 1)) {
      setSentence(at + 1);
      halt();
      setNotice(`${nameOf(voice)}'s reading stops here for now. Pick another storyteller, or ask a grown-up to prepare more.`);
      return;
    }
    if (at + 1 < sentences.length && voice) {
      setSentence(at + 1);
      sentenceRef.current = at + 1;
      void play(at + 1, voice);
    } else {
      setPlaying(false);
      endSession();
    }
  };

  const choose = (id: string) => {
    setPicker(false);
    setVoiceId(id);
    voiceRef.current = id;
    audio.clear();
    if (playing || loading) void play(sentence, id);
  };

  const goTo = (at: number) => {
    setSentence(at);
    sentenceRef.current = at;
    audio.clear();
    if ((playing || loading) && voiceId) void play(at, voiceId);
  };

  /** Back to the first sentence and reading again, whether paused or playing. */
  const startOver = () => {
    setSentence(0);
    sentenceRef.current = 0;
    audio.clear();
    if (voiceId) void play(0, voiceId);
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

  const currentReady = readyAt(voiceId, sentence);

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
          {loading && !playing && <ReadiMascot state="listening" size={72} decorative className="motion-safe:animate-bob" />}
          {sentence > 0 && (
            <button
              type="button"
              disabled={!voiceId || !readyAt(voiceId, 0)}
              onClick={startOver}
              className="min-h-14 rounded-full border-[3px] border-white/70 px-5 font-display text-lg font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              Start over
            </button>
          )}
          <button
            type="button"
            disabled={!voiceId || (!playing && !currentReady)}
            onClick={() => (playing ? halt() : voiceId && play(sentence, voiceId))}
            className="min-h-14 rounded-full bg-sunshine px-6 font-display text-xl font-semibold text-ink disabled:opacity-50"
          >
            {playing ? "Pause" : loading ? "Getting ready…" : "Play"}
          </button>
        </div>
      </div>

      {!currentReady && current && !playing && (
        <p className="rounded-2xl bg-sunshine/60 p-3 font-semibold" data-testid="not-prepared">
          {current.name}&apos;s reading isn&apos;t prepared here yet. Pick another storyteller, or ask a grown-up to prepare it.
        </p>
      )}

      {picker && (
        <div id="narrator-picker" role="group" aria-label="Choose a storyteller" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {narrators.map((n) => {
            const ready = readyAt(n.voiceId, sentence);
            return (
              <button
                key={n.voiceId}
                type="button"
                aria-pressed={n.voiceId === voiceId}
                disabled={!ready}
                onClick={() => choose(n.voiceId)}
                className={`flex flex-col items-center gap-2 rounded-3xl p-3 disabled:cursor-not-allowed ${n.voiceId === voiceId ? "bg-sunshine" : "bg-surface ring-2 ring-ink/10"}`}
              >
                <StorytellerAvatar name={n.name} avatarUrl={n.avatarUrl} tint={n.tint} size="lg" muted={!ready} />
                <span className="font-display text-lg font-semibold">{n.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ready ? "bg-mint" : "bg-ink/10"}`}>{ready ? "Ready here" : "Not ready yet"}</span>
              </button>
            );
          })}
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

      {preview && <p className="text-sm text-muted">Preview family: narration here is a stand-in sound, not a real voice.</p>}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import type { NarratorView } from "@/lib/family/service";
import type { KidsNarratorReadiness } from "@/lib/narration/narration";
import { MAX_PILLS, nextSleep, pageCount, pageOf, pageRange, parseMode, type PlayerMode, type SleepMinutes } from "@/lib/player/pages";
import { StorytellerAvatar } from "./StorytellerAvatar";
import { useGaplessAudio } from "./useGaplessAudio";

const REFRESH_MS = 10_000;
const MODE_KEY = "readli-player-mode";

const ICONS = {
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none" />,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  heads: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4.5" height="6.5" rx="2" />
      <rect x="16.5" y="14" width="4.5" height="6.5" rx="2" />
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

function Icon({ name, className = "size-6" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {ICONS[name]}
    </svg>
  );
}

const PAUSED = "Story time paused. Press Play to keep listening.";

async function errorCode(res: Response): Promise<string | undefined> {
  const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
  return body?.error?.code;
}

/**
 * Readli Kids player, with two modes over one story: Listen (dark, the storyteller's face, the
 * default) and Read-along (the cover art and highlighted words). Both share the place, storyteller,
 * sleep timer and permissions. Shows only narrators the server says this child may hear, marks which
 * have audio prepared at the current sentence, switches instantly at the current sentence when it
 * is prepared, and never generates audio while the child waits.
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
  book: { slug: string; title: string; coverUrl: string | null };
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
  const [mode, setMode] = useState<PlayerMode>("listen");
  const [sleep, setSleep] = useState<{ minutes: SleepMinutes; until: number | null }>({ minutes: null, until: null });
  const [now, setNow] = useState(() => Date.now());
  const voiceRef = useRef(voiceId);
  voiceRef.current = voiceId;
  const sentenceRef = useRef(sentence);
  sentenceRef.current = sentence;
  const listening = useRef(false);
  const audio = useGaplessAudio({ ended: () => onEnded(), error: () => void onAudioError() });

  // Listen is the default; a child's last choice on this device is remembered.
  useEffect(() => {
    try {
      setMode(parseMode(window.localStorage.getItem(MODE_KEY)));
    } catch {
      // Storage can be blocked; Listen mode is fine.
    }
  }, []);

  const switchMode = (next: PlayerMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      // Not remembered this time.
    }
  };

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

  // The sleep timer pauses the story when it runs out.
  useEffect(() => {
    if (sleep.until === null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= sleep.until!) {
        halt();
        setSleep({ minutes: null, until: null });
        setNotice("The sleep timer paused the story. Night night!");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [sleep.until, halt]);

  const cycleSleep = () => {
    const minutes = nextSleep(sleep.minutes);
    const t = Date.now();
    setNow(t);
    setSleep({ minutes, until: minutes === null ? null : t + minutes * 60_000 });
  };

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
  const back = (
    <Link href="/kids" className="flex min-h-12 shrink-0 items-center gap-2 font-display text-lg font-semibold">
      <span className="grid size-12 place-items-center rounded-full bg-current/10">
        <Icon name="left" />
      </span>
      <span className="max-sm:sr-only">My stories</span>
    </Link>
  );

  if (narrators.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
        {back}
        <h1 className="font-display text-4xl font-semibold">{book.title}</h1>
        <div className="flex flex-col items-center gap-4 rounded-panel bg-surface p-8 text-center ring-2 ring-ink/10" data-testid="no-storytellers">
          <ReadiMascot size={160} decorative />
          <h2 className="font-display text-3xl font-semibold">No storytellers yet</h2>
          <p className="max-w-md text-lg">Ask a grown-up to choose who can read stories to you, {childName}.</p>
        </div>
      </main>
    );
  }

  const currentReady = readyAt(voiceId, sentence);
  const listen = mode === "listen";
  const pages = pageCount(sentences.length);
  const page = pageOf(sentence);
  const [first, last] = pageRange(page, sentences.length);
  const where = `page ${page + 1} of ${pages}`;
  const sleepLeft = sleep.until === null ? null : Math.max(1, Math.ceil((sleep.until - now) / 60_000));
  const chip = listen ? "bg-night-line text-night-ink" : "bg-surface text-ink shadow-[0_2px_0_rgb(40_53_72/0.15)]";
  const round = `grid size-14 shrink-0 place-items-center rounded-full disabled:opacity-35 sm:size-16 ${chip}`;

  return (
    <main
      data-testid="kids-player"
      data-mode={mode}
      className={`flex min-h-dvh flex-col transition-colors ${listen ? "bg-night text-night-ink" : "bg-ivory text-ink"}`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
        <header className="flex items-center gap-3 sm:gap-4">
          {back}
          <div className="flex min-w-0 flex-1 items-center gap-1.5" aria-hidden="true">
            {pages <= MAX_PILLS ? (
              Array.from({ length: pages }, (_, i) => (
                <i
                  key={i}
                  className={`h-2.5 rounded-full ${i === page ? "flex-[1.6] bg-coral" : i < page ? "flex-1 bg-mint" : `flex-1 ${listen ? "bg-night-line" : "bg-ink/15"}`}`}
                />
              ))
            ) : (
              <span className={`h-2.5 flex-1 overflow-hidden rounded-full ${listen ? "bg-night-line" : "bg-ink/15"}`}>
                <span className="block h-full rounded-full bg-coral" style={{ width: `${((sentence + 1) / sentences.length) * 100}%` }} />
              </span>
            )}
          </div>
          <button
            type="button"
            aria-pressed={listen}
            aria-label="Just listen"
            onClick={() => switchMode(listen ? "read" : "listen")}
            className={`grid size-12 shrink-0 place-items-center rounded-full ${listen ? "bg-sunshine text-ink" : chip}`}
          >
            <Icon name="heads" />
          </button>
          <button
            type="button"
            onClick={() => setPicker((p) => !p)}
            aria-expanded={picker}
            aria-controls="narrator-picker"
            className={`flex min-h-12 shrink-0 items-center gap-2 rounded-full py-1 pr-4 pl-1 font-display text-lg font-semibold ${chip}`}
          >
            {current && <StorytellerAvatar name={current.name} avatarUrl={current.avatarUrl} tint={current.tint} size="sm" />}
            <span data-testid="current-narrator" className="max-w-[9ch] truncate sm:max-w-none">
              {current?.name ?? "Pick a storyteller"}
            </span>
            <span className="sr-only">Change storyteller</span>
            {playing && (
              <span aria-hidden="true" className="flex h-4 items-end gap-0.5">
                <b className="h-[7px] w-[3px] rounded-sm bg-coral motion-safe:animate-pulse" />
                <b className="h-3.5 w-[3px] rounded-sm bg-coral motion-safe:animate-pulse" />
                <b className="h-2.5 w-[3px] rounded-sm bg-coral motion-safe:animate-pulse" />
              </span>
            )}
          </button>
        </header>

        {listen ? (
          <section className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
            {current && (
              <span className="rounded-full ring-[6px] ring-night-line">
                <StorytellerAvatar name={current.name} avatarUrl={current.avatarUrl} tint={current.tint} size="xl" />
              </span>
            )}
            <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">{book.title}</h1>
            <p className="font-bold text-night-muted">
              {current ? `${current.name} is reading · ${where}` : where}
            </p>
            <button type="button" onClick={() => switchMode("read")} className="min-h-11 font-display font-semibold text-night-muted underline underline-offset-4">
              Show pictures and words
            </button>
          </section>
        ) : (
          <section className="grid flex-1 gap-3 md:grid-cols-2 md:gap-2">
            <div className="relative min-h-48 overflow-hidden rounded-[28px] bg-bookcase md:min-h-0 md:rounded-r-md">
              {book.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- static catalog cover art
                <img src={book.coverUrl} alt="" className="absolute inset-0 size-full object-cover object-[center_22%]" />
              ) : (
                <span className="absolute inset-0 grid place-items-center font-display text-2xl text-muted">{book.title}</span>
              )}
            </div>
            <div className="flex flex-col justify-center gap-4 rounded-[28px] bg-surface p-6 md:rounded-l-md md:p-12">
              <h1 className="font-display text-lg font-semibold text-muted">{book.title}</h1>
              <p className="font-display text-2xl leading-snug font-medium text-pretty sm:text-3xl" aria-label={book.title}>
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
              <button type="button" onClick={() => switchMode("listen")} className="min-h-11 self-start font-display font-semibold text-muted underline underline-offset-4">
                Just listen
              </button>
            </div>
          </section>
        )}

        {!currentReady && current && !playing && (
          <p className="rounded-2xl bg-sunshine p-3 font-semibold text-ink" data-testid="not-prepared">
            {current.name}&apos;s reading isn&apos;t prepared here yet. Pick another storyteller, or ask a grown-up to prepare it.
          </p>
        )}

        {notice && (
          <p role="alert" className="rounded-2xl border-[3px] border-coral-deep bg-surface p-4 font-semibold text-ink">
            {notice}
          </p>
        )}

        {picker && (
          <div className="flex flex-col gap-3 rounded-t-[28px] rounded-b-2xl bg-surface p-4 text-ink shadow-lg ring-2 ring-ink/10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Who reads to you?</h2>
              <button type="button" onClick={() => setPicker(false)} className="min-h-11 rounded-full px-4 font-display font-semibold hover:bg-ink/10">
                Done
              </button>
            </div>
            <div id="narrator-picker" role="group" aria-label="Choose a storyteller" className="flex gap-3 overflow-x-auto pb-1">
              {narrators.map((n) => {
                const ready = readyAt(n.voiceId, sentence);
                return (
                  <button
                    key={n.voiceId}
                    type="button"
                    aria-pressed={n.voiceId === voiceId}
                    disabled={!ready}
                    onClick={() => choose(n.voiceId)}
                    className={`flex w-32 shrink-0 flex-col items-center gap-2 rounded-3xl p-3 disabled:cursor-not-allowed ${n.voiceId === voiceId ? "bg-sunshine" : "bg-ivory ring-2 ring-ink/10"}`}
                  >
                    <StorytellerAvatar name={n.name} avatarUrl={n.avatarUrl} tint={n.tint} size="md" muted={!ready} />
                    <span className="font-display text-lg font-semibold">{n.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ready ? "bg-mint" : "bg-ink/10"}`}>{ready ? "Ready here" : "Not ready yet"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={cycleSleep}
            className={`flex min-h-11 items-center gap-1.5 justify-self-start font-display font-semibold ${listen ? "text-night-muted" : "text-muted"}`}
          >
            <Icon name="moon" className="size-5" />
            <span className="sr-only">Sleep timer: </span>
            {sleepLeft === null ? "Off" : `${sleepLeft}m`}
          </button>
          <button type="button" aria-label="Back" disabled={sentence === 0} onClick={() => goTo(sentence - 1)} className={round}>
            <Icon name="left" />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause" : loading ? "Getting ready…" : "Play"}
            disabled={!voiceId || (!playing && !currentReady)}
            onClick={() => (playing ? halt() : voiceId && play(sentence, voiceId))}
            className="grid size-20 place-items-center rounded-full bg-coral-strong text-white shadow-[0_6px_0_var(--color-coral-deep)] active:translate-y-1 active:shadow-[0_2px_0_var(--color-coral-deep)] disabled:opacity-50 sm:size-24"
          >
            {loading && !playing ? (
              <ReadiMascot state="listening" size={56} decorative className="motion-safe:animate-bob" />
            ) : (
              <Icon name={playing ? "pause" : "play"} className="size-9 sm:size-10" />
            )}
          </button>
          <button type="button" aria-label="Next" disabled={sentence + 1 >= sentences.length} onClick={() => goTo(sentence + 1)} className={round}>
            <Icon name="right" />
          </button>
          {sentence > 0 ? (
            <button
              type="button"
              disabled={!voiceId || !readyAt(voiceId, 0)}
              onClick={startOver}
              className={`flex min-h-11 items-center gap-1.5 justify-self-end font-display font-semibold disabled:opacity-40 ${listen ? "text-night-muted" : "text-muted"}`}
            >
              <Icon name="restart" className="size-5" />
              Start over
            </button>
          ) : (
            <span />
          )}
        </div>

        <p className="sr-only" data-testid="sentence-position">
          Sentence {sentence + 1} of {sentences.length}
        </p>
        {preview && <p className={`text-center text-xs ${listen ? "text-night-muted" : "text-muted"}`}>Preview family: narration here is a stand-in sound, not a real voice.</p>}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { isTheEnd, THE_END_PAUSE_MS } from "@/lib/content/the-end";
import type { NarratorView } from "@/lib/family/service";
import type { BookTexts, KidsNarratorReadiness } from "@/lib/narration/narration";
import { mapPosition } from "@/lib/narration/positions";
import { clock, nextSleep, pageCount, pageOf, pageRange, parseMode, sentenceAt, timeline, type PlayerMode, type SleepMinutes } from "@/lib/player/pages";
import { StorytellerAvatar } from "./StorytellerAvatar";
import { useGaplessAudio } from "./useGaplessAudio";

const REFRESH_MS = 10_000;
const MODE_KEY = "readli-player-mode";

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
 * is prepared, and never generates audio while the child waits. Each narrator's words are the text
 * their audiobook reads, so read-along always matches what is heard.
 */
export function KidsPlayer({
  childId,
  childName,
  book,
  texts: initialTexts,
  initialNarrators,
  initialReadiness,
  resume,
  preview = false,
}: {
  childId: string;
  childName: string;
  book: { slug: string; title: string; coverUrl: string | null };
  /** The text each narrator's audiobook reads, with how long each sentence takes (for the time bar). */
  texts: BookTexts;
  initialNarrators: NarratorView[];
  initialReadiness: KidsNarratorReadiness[];
  /** This child's saved place and narrator in this book, counted in that narrator's text. */
  resume: { sentence: number; voiceId: string | null };
  /** The preview family, whose narration is a stand-in sound. */
  preview?: boolean;
}) {
  const [narrators, setNarrators] = useState(initialNarrators);
  const [readiness, setReadiness] = useState(initialReadiness);
  const [voiceId, setVoiceId] = useState<string | null>(
    initialNarrators.find((n) => n.voiceId === resume.voiceId)?.voiceId ?? initialNarrators[0]?.voiceId ?? null,
  );
  const [texts, setTexts] = useState(initialTexts.texts);
  const revisionOf = (id: string | null, from = readiness) => from.find((r) => r.voiceId === id)?.revision ?? initialTexts.current;
  // The revision on screen. It follows the narrator, but never changes under a sentence being heard.
  const [shown, setShown] = useState(() => {
    const r = revisionOf(voiceId);
    return texts[r] ? r : initialTexts.current;
  });
  const { sentences, sentenceIds, seconds: sentenceSeconds } = texts[shown] ?? texts[initialTexts.current]!;
  const [sentence, setSentence] = useState(Math.max(0, Math.min(resume.sentence, sentences.length - 1)));
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<PlayerMode>("listen");
  const [sleep, setSleep] = useState<{ minutes: SleepMinutes; until: number | null }>({ minutes: null, until: null });
  const [now, setNow] = useState(() => Date.now());
  /** Seconds into the current sentence while it plays, and where the time bar is being dragged to. */
  const [spent, setSpent] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const voiceRef = useRef(voiceId);
  voiceRef.current = voiceId;
  const sentenceRef = useRef(sentence);
  sentenceRef.current = sentence;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const textsRef = useRef(texts);
  textsRef.current = texts;
  const readinessRef = useRef(readiness);
  readinessRef.current = readiness;
  const playingRef = useRef(false);
  playingRef.current = playing;
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

  /** Whether a narrator has audio here, at the same place in the text they read. */
  const readyHere = (id: string) => {
    const r = revisionOf(id);
    const t = texts[r];
    if (!t || r === shown) return readyAt(id, sentence);
    const at = mapPosition(sentences, t.sentences, sentence);
    return Boolean(readiness.find((x) => x.voiceId === id)?.readySentenceIds.includes(t.sentenceIds[at] ?? ""));
  };

  /** Shows `revision` in place of the text on screen, keeping the listener's place in the story. */
  const showRevision = (revision: string, all = textsRef.current) => {
    const from = all[shownRef.current];
    const to = all[revision];
    if (!to || revision === shownRef.current) return sentenceRef.current;
    const at = from ? mapPosition(from.sentences, to.sentences, sentenceRef.current) : 0;
    setShown(revision);
    shownRef.current = revision;
    setSentence(at);
    sentenceRef.current = at;
    return at;
  };

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

  // The time bar moves on through each sentence while it plays, up to that sentence's estimated length.
  useEffect(() => {
    setSpent(0);
  }, [sentence]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setSpent((t) => Math.min(t + 1, sentenceSeconds[sentenceRef.current] ?? 0)), 1000);
    return () => window.clearInterval(id);
  }, [playing, sentenceSeconds]);

  // Each child keeps their own place and narrator in every book.
  useEffect(() => {
    void fetch(`/api/kids/${childId}/progress`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookSlug: book.slug, sentence, voiceId, textRevision: shown }),
      keepalive: true,
    });
  }, [childId, book.slug, sentence, voiceId, shown]);

  /** Asks the server who this child may hear and what is prepared; drops a narrator no longer allowed. */
  const refresh = useCallback(async () => {
    const have = Object.keys(textsRef.current).join(",");
    const res = await fetch(`/api/kids/${childId}/books/${book.slug}?have=${have}`, { cache: "no-store" }).catch(() => null);
    if (!res) return true;
    if (!res.ok) return true;
    const body = (await res.json()) as { narrators: NarratorView[]; readiness: KidsNarratorReadiness[]; texts?: BookTexts };
    const all = { ...textsRef.current, ...body.texts?.texts };
    setTexts(all);
    textsRef.current = all;
    const current = voiceRef.current;
    // A finished update to this narrator's reading waits until listening stops; until then the
    // story carries on in the reading the child is hearing.
    const hearing = listening.current || playingRef.current;
    const kept = readinessRef.current.find((r) => r.voiceId === current);
    const next =
      hearing && kept && kept.revision === shownRef.current
        ? body.readiness.map((r) => (r.voiceId === current && r.revision !== kept.revision ? kept : r))
        : body.readiness;
    setNarrators(body.narrators);
    setReadiness(next);
    readinessRef.current = next;
    if (current && !hearing) showRevision(revisionOf(current, next), all);
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
      body: JSON.stringify({ childId, voiceId: voice, bookSlug: book.slug, sentence: at, revision: shownRef.current }),
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
        if (code === "book_updated") {
          // This reading was replaced by an update; show the new one at the same place.
          await refresh();
          setNotice(PAUSED);
        } else if (code === "not_prepared") {
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
      setSpent(0);
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
    // A book prepared before "The End." was added simply finishes without it.
    if (isTheEnd(sentences, at + 1) && !readyAt(voice, at + 1)) {
      setPlaying(false);
      endSession();
      return;
    }
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
      if (isTheEnd(sentences, at + 1)) audio.after(THE_END_PAUSE_MS, () => void play(at + 1, voice));
      else void play(at + 1, voice);
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
    // Each narrator shows the words they read; the place carries over to the same sentence.
    const at = showRevision(revisionOf(id));
    if (playing || loading) void play(at, id);
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
    <Link href="/kids" className="grid size-12 shrink-0 place-items-center rounded-full bg-current/10">
      <Icon name="left" />
      <span className="sr-only">My stories</span>
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
  const sleepLeft = sleep.until === null ? null : Math.max(1, Math.ceil((sleep.until - now) / 60_000));
  const starts = timeline(sentenceSeconds);
  const total = starts[starts.length - 1] ?? 0;
  const elapsed = scrub ?? Math.min(total, (starts[sentence] ?? 0) + spent);
  const shownPage = scrub === null ? page : pageOf(sentenceAt(starts, scrub));
  const percent = total ? (elapsed / total) * 100 : 0;
  const soft = listen ? "bg-white/10" : "bg-ink/8";
  const faint = listen ? "text-night-muted" : "text-muted";
  const round = `grid size-14 shrink-0 place-items-center rounded-full disabled:opacity-35 ${soft}`;
  const side = `flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 font-display text-xs font-semibold whitespace-nowrap disabled:opacity-40 ${faint}`;

  /** Lets go of the time bar and jumps to the sentence under it. */
  const commitScrub = () => {
    if (scrub === null) return;
    const at = sentenceAt(starts, scrub);
    setScrub(null);
    if (at !== sentence) goTo(at);
  };

  const reading = current && (
    <p className={`flex items-center gap-2 font-bold ${faint}`}>
      <StorytellerAvatar name={current.name} avatarUrl={current.avatarUrl} tint={current.tint} size="xs" />
      {current.name} is reading
    </p>
  );
  // An empty 3:4 box sized by the layout, so the whole cover always fits without cropping or scrolling.
  const cover = (className: string) => (
    <div data-testid="player-cover" className={`relative grid aspect-[3/4] place-items-center overflow-hidden bg-bookcase ${className}`}>
      {book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- static catalog cover art
        <img src={book.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="p-3 text-center font-display text-muted">{book.title}</span>
      )}
    </div>
  );

  return (
    <main
      data-testid="kids-player"
      data-mode={mode}
      className={`flex h-dvh flex-col overflow-y-auto transition-colors ${listen ? "bg-night text-night-ink" : "bg-ivory text-ink"}`}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:px-10 sm:pt-[max(2.5rem,env(safe-area-inset-top))] sm:pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center gap-2.5">
          {back}
          <div role="group" aria-label="Player mode" className={`flex min-w-0 flex-1 rounded-full p-1 font-display font-semibold sm:mx-auto sm:max-w-[340px] sm:text-lg ${soft}`}>
            {(["listen", "read"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => switchMode(m)}
                className={`min-h-10 flex-1 rounded-full px-1 whitespace-nowrap ${mode === m ? "bg-sunshine text-ink" : "opacity-75"}`}
              >
                {m === "listen" ? "Just listen" : "Read along"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPicker((p) => !p)}
            aria-expanded={picker}
            aria-controls="narrator-picker"
            className={`flex min-h-12 shrink-0 items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 font-display font-semibold ${soft}`}
          >
            {current && <StorytellerAvatar name={current.name} avatarUrl={current.avatarUrl} tint={current.tint} size="sm" />}
            <span data-testid="current-narrator" className={`max-w-[9ch] truncate ${current ? "max-sm:sr-only" : ""}`}>
              {current?.name ?? "Pick a storyteller"}
            </span>
            <span className="sr-only">Change storyteller</span>
            {playing ? (
              <span aria-hidden="true" className="flex h-4 w-[18px] items-end justify-center gap-0.5">
                <b className="h-[7px] w-[3px] rounded-sm bg-coral motion-safe:animate-pulse" />
                <b className="h-3.5 w-[3px] rounded-sm bg-coral motion-safe:animate-pulse" />
                <b className="h-2.5 w-[3px] rounded-sm bg-coral motion-safe:animate-pulse" />
              </span>
            ) : (
              <Icon name="down" className="size-[18px]" />
            )}
          </button>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {listen ? (
            <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
              {cover("max-h-[470px] min-h-0 max-w-full flex-auto rounded-[22px] shadow-[0_10px_30px_rgb(0_0_0/0.3)] sm:max-h-[720px] sm:rounded-[28px]")}
              <div className="flex flex-col items-center gap-1.5">
                <h1 className="font-display text-[26px] leading-tight font-semibold text-balance sm:text-4xl">{book.title}</h1>
                {reading}
              </div>
            </section>
          ) : (
            <section className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex items-center gap-3.5">
                {cover("w-[84px] shrink-0 rounded-xl shadow-[0_4px_12px_rgb(40_53_72/0.2)] sm:w-[150px] sm:rounded-[18px]")}
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h1 className="font-display text-[22px] leading-tight font-semibold text-balance sm:text-3xl">{book.title}</h1>
                  {reading}
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl bg-surface p-[22px] ring-2 ring-ink/8 ring-inset sm:rounded-[32px] sm:p-12">
                <p className="my-auto font-display text-[21px] leading-[1.4] font-medium text-pretty sm:text-[34px]">
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
          )}

          {picker && (
            <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-xl flex-col gap-3 rounded-[28px] bg-surface p-4 text-ink shadow-lg ring-2 ring-ink/10">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold">Who reads to you?</h2>
                <button type="button" onClick={() => setPicker(false)} className="min-h-11 rounded-full px-4 font-display font-semibold hover:bg-ink/10">
                  Done
                </button>
              </div>
              <div id="narrator-picker" role="group" aria-label="Choose a storyteller" className="flex gap-3 overflow-x-auto pb-1">
                {narrators.map((n) => {
                  const ready = readyHere(n.voiceId);
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
        </div>

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
              onPointerUp={commitScrub}
              onKeyUp={commitScrub}
              onBlur={commitScrub}
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

        <div className="mx-auto grid w-full max-w-[640px] grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-3.5 sm:gap-7">
          <button type="button" onClick={cycleSleep} aria-label={`Sleep timer: ${sleepLeft === null ? "Off" : `${sleepLeft}m`}`} className={`justify-self-start ${side}`}>
            <Icon name="moon" className="size-6" />
            {sleepLeft === null ? "Sleep" : `${sleepLeft}m`}
          </button>
          <button type="button" aria-label="Back" disabled={sentence === 0} onClick={() => goTo(sentence - 1)} className={round}>
            <Icon name="prev" className="size-[26px]" />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause" : loading ? "Getting ready…" : "Play"}
            disabled={!voiceId || (!playing && !currentReady)}
            onClick={() => (playing ? halt() : voiceId && play(sentence, voiceId))}
            className="grid size-21 place-items-center rounded-full bg-coral-strong text-white shadow-[0_6px_0_var(--color-coral-deep)] active:translate-y-1 active:shadow-[0_2px_0_var(--color-coral-deep)] disabled:opacity-50 sm:size-25"
          >
            {loading && !playing ? (
              <ReadiMascot state="listening" size={56} decorative className="motion-safe:animate-bob" />
            ) : (
              <Icon name={playing ? "pause" : "play"} className="size-9 sm:size-10" />
            )}
          </button>
          <button type="button" aria-label="Next" disabled={sentence + 1 >= sentences.length} onClick={() => goTo(sentence + 1)} className={round}>
            <Icon name="next" className="size-[26px]" />
          </button>
          {sentence > 0 ? (
            <button type="button" disabled={!voiceId || !readyAt(voiceId, 0)} onClick={startOver} className={`justify-self-end ${side}`}>
              <Icon name="restart" className="size-6" />
              Start over
            </button>
          ) : (
            <span />
          )}
        </div>

        <p className="sr-only" data-testid="sentence-position">
          Sentence {sentence + 1} of {sentences.length}
        </p>
        {preview && <p className={`-mt-2 text-center text-xs ${faint}`}>Preview family: narration here is a stand-in sound, not a real voice.</p>}
      </div>
    </main>
  );
}

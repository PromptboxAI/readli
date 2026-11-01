"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { isTheEnd, THE_END_PAUSE_MS } from "@/lib/content/the-end";
import type { NarratorView } from "@/lib/family/service";
import type { BookTexts, KidsNarratorReadiness } from "@/lib/narration/narration";
import { mapPosition } from "@/lib/narration/positions";
import { parseMode, type PlayerMode } from "@/lib/player/pages";
import { chapterReady, type Track } from "@/lib/player/tracks";
import { Icon, ListenStage, ModeToggle, PLAYER_COLUMN, PLAYER_MAIN, PlayingBars, playerTone, ReadStage, SleepButton, TimeBar } from "./PlayerParts";
import { StorytellerAvatar } from "./StorytellerAvatar";
import { AHEAD, useGaplessAudio } from "./useGaplessAudio";
import { useMediaSession } from "./useMediaSession";
import { usePlaceSaver } from "./usePlaceSaver";
import { useSleepTimer } from "./useSleepTimer";
import { useTrackAudio } from "./useTrackAudio";

const REFRESH_MS = 10_000;
const MODE_KEY = "readli-player-mode";

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
 * their audiobook reads, so read-along always matches what is heard. A fully prepared chapter plays as
 * one continuous track, with the sentence on screen following its clock; anything else plays sentence
 * by sentence.
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
  const { sentences, sentenceIds, chapters, seconds: sentenceSeconds } = texts[shown] ?? texts[initialTexts.current]!;
  const [sentence, setSentence] = useState(Math.max(0, Math.min(resume.sentence, sentences.length - 1)));
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<PlayerMode>("listen");
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
  const failures = useRef<{ key: string; count: number } | null>(null);
  const audio = useGaplessAudio({
    ended: () => {
      failures.current = null;
      onEnded();
    },
    error: (why) => onClipFailed(why),
    interrupted: () => onInterrupted(),
  });
  const track = useTrackAudio({
    sentence: (at) => {
      setSentence(at);
      sentenceRef.current = at;
    },
    ended: () => {
      trackFailed.current = null;
      onEnded();
    },
    error: (why) => onTrackFailed(why),
    time: () => checkSleep(),
    interrupted: () => onInterrupted(),
    resumed: () => {
      setNotice(null);
      setPlaying(true);
    },
    // A track needs no request per sentence, so playing keeps the listening session alive and re-checks
    // who this child may hear, even with the screen locked.
    tick: () => {
      void fetch(`/api/kids/${childId}/listening`, { method: "POST" }).catch(() => null);
      void refresh();
    },
  });
  // Chapters that play sentence by sentence because their track couldn't be had, and the last track that failed to play.
  const noTrack = useRef(new Set<string>());
  const trackFailed = useRef<string | null>(null);

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
    track.pause();
    setPlaying(false);
    setLoading(false);
    endSession();
  }, [audio, track, endSession]);

  useEffect(() => endSession, [endSession]);

  const sleep = useSleepTimer(`readli-sleep:${childId}`, halt, setNotice);
  const checkSleep = sleep.check;

  // Each child keeps their own place and narrator in every book. Opening a book saves nothing; a place
  // this device couldn't save last time is sent first, and picked up if it's the newest.
  const moved = useRef(false);
  const places = usePlaceSaver(`/api/kids/${childId}/progress`, `readli-place:${childId}:${book.slug}`, { bookSlug: book.slug }, (place) => {
    if (moved.current || playingRef.current || listening.current) return;
    const id = narrators.find((n) => n.voiceId === place.voiceId)?.voiceId;
    const to = textsRef.current[place.textRevision];
    if (!id || !to) return;
    setVoiceId(id);
    voiceRef.current = id;
    showRevision(place.textRevision);
    const at = Math.max(0, Math.min(place.sentence, to.sentences.length - 1));
    setSentence(at);
    sentenceRef.current = at;
  });
  const opening = useRef({ sentence, voiceId, shown });
  useEffect(() => {
    const o = opening.current;
    if (!moved.current && o.sentence === sentence && o.voiceId === voiceId && o.shown === shown) return;
    moved.current = true;
    places.save({ sentence, voiceId, textRevision: shown });
  }, [places, sentence, voiceId, shown]);

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

  /** A signed URL for one prepared sentence, or null when it can't be had right now. */
  const urlFor = async (at: number, voice: string) => {
    const res = await fetchUrl(at, voice).catch(() => null);
    if (res && !res.ok && (await errorCode(res)) === "no_listening_session") listening.current = false;
    if (!res?.ok || voiceRef.current !== voice) return null;
    return ((await res.json()) as { url: string }).url;
  };

  /** Buffers the next few prepared sentences while this one plays, so the story flows without a pause. */
  const prefetch = (at: number, voice: string) => {
    const upcoming: { key: string; url: () => Promise<string | null> }[] = [];
    for (let i = at + 1; i <= at + AHEAD && i < sentences.length && readyAt(voice, i); i++) {
      upcoming.push({ key: `${voice}:${i}`, url: () => urlFor(i, voice) });
    }
    audio.preload(upcoming);
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

  /** The chapter track that holds sentence `at` in the text on screen, named by voice, text and chapter. */
  const trackKey = (voice: string, at: number) => `${voice}:${shownRef.current}:${textsRef.current[shownRef.current]?.chapters[at]}`;

  /** Explains why a story can't play right now, after the server said no. */
  const explain = async (code: string | undefined, voice: string) => {
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
  };

  const play = async (at: number, voice: string): Promise<void> => {
    setNotice(null);
    const text = textsRef.current[shownRef.current];
    const ready = readinessRef.current.find((r) => r.voiceId === voice)?.readySentenceIds ?? [];
    if (text && chapterReady(text, ready, at) && !noTrack.current.has(trackKey(voice, at))) return playTrack(at, voice);
    track.clear();
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
      if (!res?.ok) return explain(code, voice);
      url = ((await res.json()) as { url: string }).url;
    }
    try {
      await audio.play(key, url);
      setPlaying(true);
      setLoading(false);
      prefetch(at, voice);
    } catch (why) {
      onClipFailed(why, at);
    }
  };

  /** A signed URL for the chapter track holding sentence `at`; every permission gate is checked on the server. */
  const fetchTrack = (at: number, voice: string) =>
    fetch("/api/kids/narrations/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ childId, voiceId: voice, bookSlug: book.slug, chapter: textsRef.current[shownRef.current]?.chapters[at], revision: shownRef.current }),
    });

  /** Plays a fully prepared chapter as one track from sentence `at`, or falls back to sentence by sentence. */
  const playTrack = async (at: number, voice: string): Promise<void> => {
    const key = trackKey(voice, at);
    audio.pause();
    audio.clear();
    try {
      if (track.has(key, at) && listening.current) {
        await track.seek(at);
      } else {
        setLoading(true);
        if (!(await startSession())) return;
        let res = await fetchTrack(at, voice).catch(() => null);
        let code = res && !res.ok ? await errorCode(res) : undefined;
        if (code === "no_listening_session") {
          listening.current = false;
          if (!(await startSession())) return;
          res = await fetchTrack(at, voice).catch(() => null);
          code = res && !res.ok ? await errorCode(res) : undefined;
        }
        if (voiceRef.current !== voice) return;
        if (!res || code === "not_prepared" || code === "track_unavailable") {
          noTrack.current.add(key);
          return play(at, voice);
        }
        if (!res.ok) return explain(code, voice);
        await track.load(key, (await res.json()) as Track, at);
      }
      setPlaying(true);
      setLoading(false);
    } catch (why) {
      onTrackFailed(why, at);
    }
  };

  /**
   * A track that won't play is asked for once more (its URL may have run out during a long pause), then
   * the chapter carries on sentence by sentence. Asking again re-checks access, so a revoked voice stops.
   */
  const onTrackFailed = (why: unknown, at = sentenceRef.current) => {
    const voice = voiceRef.current;
    if (why instanceof DOMException && why.name === "AbortError") return;
    console.warn(`Readli: the chapter track didn't play at sentence ${at + 1}`, why);
    if (!voice || (why instanceof DOMException && why.name === "NotAllowedError")) {
      halt();
      setNotice(PAUSED);
      return;
    }
    const key = trackKey(voice, at);
    track.clear();
    if (trackFailed.current === key) noTrack.current.add(key);
    trackFailed.current = key;
    void play(at, voice);
  };

  /**
   * A sentence whose audio won't load or play is fetched once more, then skipped, so one bad clip never
   * stops the story. The fresh fetch re-checks access on the server, so a revoked voice still stops here.
   */
  const onClipFailed = (why: unknown, at = sentenceRef.current) => {
    const voice = voiceRef.current;
    // Pausing, seeking or switching storyteller interrupts a clip that is starting; that isn't a failure.
    if (why instanceof DOMException && why.name === "AbortError") return;
    console.warn(`Readli: sentence ${at + 1} didn't play`, why);
    if (!voice || (why instanceof DOMException && why.name === "NotAllowedError")) {
      // The browser wants a tap before it plays again.
      halt();
      setNotice(PAUSED);
      return;
    }
    const key = `${voice}:${at}`;
    const tries = failures.current?.key === key ? failures.current.count + 1 : 1;
    failures.current = { key, count: tries };
    audio.clear();
    if (tries === 1) {
      void play(at, voice);
    } else {
      sentenceRef.current = at;
      onEnded();
    }
  };

  const onEnded = () => {
    if (checkSleep()) return;
    const at = sentenceRef.current;
    const voice = voiceRef.current;
    if (sleep.chapterEnd(chapters, at)) {
      setSentence(at + 1);
      sentenceRef.current = at + 1;
      return;
    }
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
    track.clear();
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

  /**
   * A phone call, Siri, another app's audio or unplugged headphones paused the story. The screen says
   * so, and Play (here, on the lock screen or on headphones) picks up at the same sentence.
   */
  const onInterrupted = () => {
    halt();
    setNotice(PAUSED);
  };

  // The lock screen, notification shade, headphones and car show the story and work its buttons.
  useMediaSession(
    { title: book.title, narrator: narrators.find((n) => n.voiceId === voiceId)?.name ?? null, coverUrl: book.coverUrl },
    playing,
    sentence,
    {
      play: () => {
        if (!playingRef.current && voiceRef.current) void play(sentenceRef.current, voiceRef.current);
      },
      pause: () => halt(),
      previous: () => sentenceRef.current > 0 && goTo(sentenceRef.current - 1),
      next: () => sentenceRef.current + 1 < sentences.length && goTo(sentenceRef.current + 1),
      skip: (seconds) => {
        if (!track.skip(seconds)) goTo(Math.max(0, Math.min(sentences.length - 1, sentenceRef.current + Math.sign(seconds))));
      },
      seekTo: (seconds) => {
        const p = track.position();
        if (p) track.skip(seconds - p.position);
      },
    },
    track.position,
  );

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
  const { listen, soft, faint, main, round, side } = playerTone(mode);

  const reading = current && (
    <p className={`flex items-center gap-2 font-bold ${faint}`}>
      <StorytellerAvatar name={current.name} avatarUrl={current.avatarUrl} tint={current.tint} size="xs" />
      {current.name} is reading
    </p>
  );

  return (
    <main data-testid="kids-player" data-mode={mode} className={`${PLAYER_MAIN} ${main}`}>
      <div className={PLAYER_COLUMN}>
        <header className="flex items-center gap-2.5">
          {back}
          <ModeToggle mode={mode} onChange={switchMode} />
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
            {playing ? <PlayingBars /> : <Icon name="down" className="size-[18px]" />}
          </button>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {listen ? (
            <ListenStage coverUrl={book.coverUrl} title={book.title} byline={reading} />
          ) : (
            <ReadStage coverUrl={book.coverUrl} title={book.title} byline={reading} sentences={sentences} sentence={sentence} />
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

        <TimeBar mode={mode} seconds={sentenceSeconds} sentence={sentence} playing={playing} onSeek={goTo} />

        <div className="mx-auto grid w-full max-w-[640px] grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-3.5 sm:gap-7">
          <SleepButton label={sleep.label} onClick={() => sleep.cycle(new Set(chapters).size > 1)} className={side} />
          <button type="button" aria-label="Back" disabled={sentence === 0} onClick={() => goTo(sentence - 1)} className={round}>
            <Icon name="prev" className="size-[26px]" />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause" : loading ? "Getting ready…" : "Play"}
            disabled={!voiceId || (!playing && !currentReady)}
            onClick={() => {
              if (playing) return halt();
              track.unlock();
              if (voiceId) void play(sentence, voiceId);
            }}
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
            <button
              type="button"
              disabled={!voiceId || !readyAt(voiceId, 0)}
              onClick={() => {
                track.unlock();
                startOver();
              }}
              className={`justify-self-end ${side}`}
            >
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

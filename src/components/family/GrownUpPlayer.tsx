"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { parentPrimary } from "@/components/brand/buttons";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { isTheEnd, THE_END_PAUSE_MS } from "@/lib/content/the-end";
import type { ListenView } from "@/lib/narration/narration";
import { mapPosition } from "@/lib/narration/positions";
import { parseMode, type PlayerMode } from "@/lib/player/pages";
import { chapterReady, type Track } from "@/lib/player/tracks";
import { Icon, ListenStage, ModeToggle, PLAYER_COLUMN, PLAYER_MAIN, PlayingBars, playerTone, ReadStage, TimeBar } from "./PlayerParts";
import { StorytellerAvatar } from "./StorytellerAvatar";
import { AHEAD, useGaplessAudio } from "./useGaplessAudio";
import { useMediaSession } from "./useMediaSession";
import { usePlaceSaver } from "./usePlaceSaver";
import { useTrackAudio } from "./useTrackAudio";

const MODE_KEY = "readli-grown-up-player-mode";

/**
 * The Parent Portal player: plays a prepared book from stored audio, in any voice the family may use,
 * and stops where the prepared audio ends instead of generating more. A fully prepared chapter plays as
 * one continuous track, with the sentence on screen following its clock; anything else plays sentence by
 * sentence. The
 * words shown are the text the chosen voice's audiobook reads. It shares the Readli Kids player's
 * one-screen layout: Listen shows the whole cover, Read-along shows the page being read.
 */
export function GrownUpPlayer({
  view,
  initialVoice,
  resume = 0,
  preview = false,
}: {
  view: ListenView;
  initialVoice: string | null;
  /** This grown-up's own saved place, counted in the text `initialVoice` reads. */
  resume?: number;
  preview?: boolean;
}) {
  const { book, voices, texts } = view;
  const [voiceId, setVoiceId] = useState(initialVoice);
  const revisionOf = (id: string | null) => {
    const r = voices.find((v) => v.voiceId === id)?.revision;
    return r && texts.texts[r] ? r : texts.current;
  };
  const [shown, setShown] = useState(() => revisionOf(initialVoice));
  const { sentences, sentenceIds, seconds } = texts.texts[shown] ?? texts.texts[texts.current]!;
  const [sentence, setSentence] = useState(Math.max(0, Math.min(resume, sentences.length - 1)));
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  // Grown-ups start in Read-along to follow the words; their last choice on this device is remembered.
  const [mode, setMode] = useState<PlayerMode>("read");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      if (saved) setMode(parseMode(saved));
    } catch {
      // Storage can be blocked; Read-along is fine.
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
  const voiceRef = useRef(voiceId);
  voiceRef.current = voiceId;
  const sentenceRef = useRef(sentence);
  sentenceRef.current = sentence;
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
    interrupted: () => onInterrupted(),
    resumed: () => {
      setNotice(null);
      setPlaying(true);
    },
  });
  // Chapters that play sentence by sentence because their track couldn't be had, and the last track that failed to play.
  const noTrack = useRef(new Set<string>());
  const trackFailed = useRef<string | null>(null);

  // A grown-up's place is their own, apart from every child's. Opening a book saves nothing; a place this
  // device couldn't save last time is sent first, and picked up if it's the newest.
  const moved = useRef(false);
  const places = usePlaceSaver(`/api/family/books/${book.slug}/progress`, `readli-place:adult:${view.householdId}:${book.slug}`, {}, (place) => {
    const id = voices.find((v) => v.voiceId === place.voiceId)?.voiceId;
    const to = texts.texts[place.textRevision];
    if (moved.current || playing || loading || !id || !to || revisionOf(id) !== place.textRevision) return;
    setVoiceId(id);
    voiceRef.current = id;
    setShown(place.textRevision);
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

  const voice = voices.find((v) => v.voiceId === voiceId) ?? null;
  // Counted in the text that voice reads, so a place right after switching voices checks the right sentence.
  const readyAt = (id: string | null, at: number) =>
    Boolean(id && voices.find((v) => v.voiceId === id)?.readySentenceIds.includes((texts.texts[revisionOf(id)]?.sentenceIds ?? sentenceIds)[at] ?? ""));

  const stop = () => {
    audio.pause();
    track.pause();
    setPlaying(false);
    setLoading(false);
  };

  /** A signed URL for one prepared sentence; the server re-checks plan, share and slot each time. */
  const fetchUrl = (at: number, id: string) =>
    fetch(`/api/family/books/${book.slug}/listen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voiceId: id, sentence: at, revision: revisionOf(id) }),
    });

  /** Buffers the next few prepared sentences while this one plays, so the story flows without a pause. */
  const prefetch = (at: number, id: string) => {
    const upcoming: { key: string; url: () => Promise<string | null> }[] = [];
    for (let i = at + 1; i <= at + AHEAD && i < sentences.length && readyAt(id, i); i++) {
      upcoming.push({
        key: `${id}:${i}`,
        url: async () => {
          const res = await fetchUrl(i, id).catch(() => null);
          if (!res?.ok || voiceRef.current !== id) return null;
          return ((await res.json()) as { url: string }).url;
        },
      });
    }
    audio.preload(upcoming);
  };

  const textOf = (id: string) => texts.texts[revisionOf(id)] ?? texts.texts[texts.current]!;
  /** The chapter track that holds sentence `at` in this voice, named by voice, text and chapter. */
  const trackKey = (id: string, at: number) => `${id}:${revisionOf(id)}:${textOf(id).chapters[at]}`;

  const play = async (at: number, id: string): Promise<void> => {
    setNotice(null);
    if (!readyAt(id, at)) {
      stop();
      setNotice(`${voices.find((v) => v.voiceId === id)?.name ?? "This storyteller"}'s reading isn't prepared here yet.`);
      return;
    }
    const ready = voices.find((v) => v.voiceId === id)?.readySentenceIds ?? [];
    if (chapterReady(textOf(id), ready, at) && !noTrack.current.has(trackKey(id, at))) return playTrack(at, id);
    track.clear();
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
      prefetch(at, id);
    } catch (why) {
      onClipFailed(why, at);
    }
  };

  /** Plays a fully prepared chapter as one track from sentence `at`, or falls back to sentence by sentence. */
  const playTrack = async (at: number, id: string): Promise<void> => {
    const key = trackKey(id, at);
    audio.pause();
    audio.clear();
    try {
      if (track.has(key, at)) {
        await track.seek(at);
      } else {
        setLoading(true);
        const res = await fetch(`/api/family/books/${book.slug}/listen/track`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ voiceId: id, chapter: textOf(id).chapters[at], revision: revisionOf(id) }),
        }).catch(() => null);
        if (voiceRef.current !== id) return;
        if (!res?.ok) {
          const body = (await res?.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
          if (!res || body?.error?.code === "not_prepared" || body?.error?.code === "track_unavailable") {
            noTrack.current.add(key);
            return play(at, id);
          }
          stop();
          setNotice(body?.error?.message ?? "This story isn't available right now.");
          return;
        }
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
   * the chapter carries on sentence by sentence.
   */
  const onTrackFailed = (why: unknown, at = sentenceRef.current) => {
    const id = voiceRef.current;
    if (why instanceof DOMException && why.name === "AbortError") return;
    console.warn(`Readli: the chapter track didn't play at sentence ${at + 1}`, why);
    if (!id || (why instanceof DOMException && why.name === "NotAllowedError")) {
      stop();
      setNotice("Story paused. Press Play to keep listening.");
      return;
    }
    const key = trackKey(id, at);
    track.clear();
    if (trackFailed.current === key) noTrack.current.add(key);
    trackFailed.current = key;
    void play(at, id);
  };

  /** A sentence whose audio won't load or play is fetched once more, then skipped, so one bad clip never stops the story. */
  const onClipFailed = (why: unknown, at = sentenceRef.current) => {
    const id = voiceRef.current;
    // Pausing, seeking or switching storyteller interrupts a clip that is starting; that isn't a failure.
    if (why instanceof DOMException && why.name === "AbortError") return;
    console.warn(`Readli: sentence ${at + 1} didn't play`, why);
    if (!id || (why instanceof DOMException && why.name === "NotAllowedError")) {
      // The browser wants a tap before it plays again.
      stop();
      setNotice("Story paused. Press Play to keep listening.");
      return;
    }
    const key = `${id}:${at}`;
    const tries = failures.current?.key === key ? failures.current.count + 1 : 1;
    failures.current = { key, count: tries };
    audio.clear();
    if (tries === 1) {
      void play(at, id);
    } else {
      sentenceRef.current = at;
      onEnded();
    }
  };

  const onEnded = () => {
    const next = sentenceRef.current + 1;
    const id = voiceRef.current;
    if (next >= sentences.length || !id) return stop();
    // A book prepared before "The End." was added simply finishes without it.
    if (isTheEnd(sentences, next) && !readyAt(id, next)) return stop();
    setSentence(next);
    sentenceRef.current = next;
    if (readyAt(id, next) && isTheEnd(sentences, next)) audio.after(THE_END_PAUSE_MS, () => void play(next, id));
    else if (readyAt(id, next)) void play(next, id);
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

  /** Back to the first sentence and reading again, whether paused or playing. */
  const startOver = () => {
    audio.clear();
    setSentence(0);
    sentenceRef.current = 0;
    if (voiceId) void play(0, voiceId);
  };

  const choose = (id: string) => {
    audio.clear();
    track.clear();
    setVoiceId(id);
    voiceRef.current = id;
    // The place carries over to the same sentence in the text this voice reads.
    const next = revisionOf(id);
    const at = next === shown ? sentence : mapPosition(sentences, texts.texts[next]?.sentences ?? sentences, sentence);
    setShown(next);
    setSentence(at);
    sentenceRef.current = at;
    if (playing || loading) void play(at, id);
  };

  /** A phone call, Siri, another app's audio or unplugged headphones paused the story; Play picks up at the same sentence. */
  const onInterrupted = () => {
    stop();
    setNotice("Story paused. Press Play to keep listening.");
  };

  // The lock screen, notification shade, headphones and car show the story and work its buttons.
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useMediaSession(
    { title: book.title, narrator: voice?.name ?? null, coverUrl: book.coverUrl },
    playing,
    sentence,
    {
      play: () => {
        if (!playingRef.current && voiceRef.current) void play(sentenceRef.current, voiceRef.current);
      },
      pause: () => stop(),
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

  const { listen, soft, faint, main, round, side } = playerTone(mode);
  const back = (
    <Link href={`/family/books/${book.slug}`} className="grid size-12 shrink-0 place-items-center rounded-full bg-current/10">
      <Icon name="left" />
      <span className="sr-only">Back to {book.title}</span>
    </Link>
  );

  if (voices.length === 0) {
    return (
      <main data-testid="grown-up-player" className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 bg-ivory px-4 py-6 text-ink sm:px-6">
        {back}
        <h1 className="font-display text-4xl font-semibold">{book.title}</h1>
        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10" data-testid="nothing-prepared">
          <p className="text-lg font-semibold">This book isn&apos;t prepared in a family voice yet.</p>
          <Link href={`/family/books/${book.slug}`} className={`${parentPrimary} self-start`}>
            Prepare narration
          </Link>
        </div>
      </main>
    );
  }

  const byline = (
    <p className={`flex items-center gap-2 font-bold ${faint}`}>
      {voice && <StorytellerAvatar name={voice.name} avatarUrl={voice.avatarUrl} tint={voice.tint} size="xs" />}
      {voice ? `${voice.name} is reading` : book.author}
    </p>
  );

  return (
    <main data-testid="grown-up-player" data-mode={mode} className={`${PLAYER_MAIN} ${main}`}>
      <div className={PLAYER_COLUMN}>
        <header className="flex items-center gap-2.5">
          {back}
          <ModeToggle mode={mode} onChange={switchMode} />
          <button
            type="button"
            onClick={() => setPicker((p) => !p)}
            aria-expanded={picker}
            aria-controls="storyteller-picker"
            className={`flex min-h-12 shrink-0 items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 font-display font-semibold ${soft}`}
          >
            {voice && <StorytellerAvatar name={voice.name} avatarUrl={voice.avatarUrl} tint={voice.tint} size="sm" />}
            <span data-testid="current-narrator" className={`max-w-[9ch] truncate ${voice ? "max-sm:sr-only" : ""}`}>
              {voice?.name ?? "Pick a storyteller"}
            </span>
            <span className="sr-only">Change storyteller</span>
            {playing ? <PlayingBars /> : <Icon name="down" className="size-[18px]" />}
          </button>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {listen ? (
            <ListenStage coverUrl={book.coverUrl} title={book.title} byline={byline} />
          ) : (
            <ReadStage coverUrl={book.coverUrl} title={book.title} byline={byline} sentences={sentences} sentence={sentence} />
          )}

          {picker && (
            <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-xl flex-col gap-3 rounded-[28px] bg-surface p-4 text-ink shadow-lg ring-2 ring-ink/10">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold">Storyteller</h2>
                <button type="button" onClick={() => setPicker(false)} className="min-h-11 rounded-full px-4 font-display font-semibold hover:bg-ink/10">
                  Done
                </button>
              </div>
              <div id="storyteller-picker" role="group" aria-label="Storyteller" className="flex gap-3 overflow-x-auto pb-1">
                {voices.map((v) => (
                  <button
                    key={v.voiceId}
                    type="button"
                    aria-pressed={v.voiceId === voiceId}
                    onClick={() => {
                      setPicker(false);
                      choose(v.voiceId);
                    }}
                    className={`flex w-36 shrink-0 flex-col items-center gap-2 rounded-3xl p-3 ${v.voiceId === voiceId ? "bg-sunshine" : "bg-ivory ring-2 ring-ink/10"}`}
                  >
                    <StorytellerAvatar name={v.name} avatarUrl={v.avatarUrl} tint={v.tint} size="md" />
                    <span className="font-display text-lg font-semibold">{v.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-center text-xs font-bold ${v.complete ? "bg-mint" : "bg-ink/10"}`}>
                      {v.complete ? "Whole book ready" : `${v.readySentenceIds.length} of ${sentences.length} sentences ready`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {voice && !voice.complete && (
          <p className={`text-sm ${faint}`}>
            {voice.name}&apos;s reading covers {voice.readySentenceIds.length} of {sentences.length} sentences.{" "}
            <Link href={`/family/books/${book.slug}`} className="font-semibold underline underline-offset-4">
              Prepare the rest
            </Link>
          </p>
        )}
        {notice && (
          <p role="alert" className="rounded-2xl border-[3px] border-coral-deep bg-surface p-4 font-semibold text-ink">
            {notice}
          </p>
        )}

        <TimeBar mode={mode} seconds={seconds} sentence={sentence} playing={playing} onSeek={goTo} />

        <div className="mx-auto grid w-full max-w-[640px] grid-cols-[1fr_auto_auto_auto_1fr] items-center gap-3.5 sm:gap-7">
          <span />
          <button type="button" aria-label="Back" disabled={sentence === 0} onClick={() => goTo(sentence - 1)} className={round}>
            <Icon name="prev" className="size-[26px]" />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause" : loading ? "Getting ready…" : "Play"}
            disabled={!voiceId || (!playing && !readyAt(voiceId, sentence))}
            onClick={() => {
              if (playing) return stop();
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

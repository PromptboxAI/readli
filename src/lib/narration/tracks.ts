import { createHash } from "node:crypto";
import { isTheEnd, THE_END_PAUSE_MS } from "@/lib/content/the-end";
import { JoinError, joinClips } from "@/lib/audio/join";
import type { FamilyState, NarrationLibrary } from "@/lib/family/model";
import type { NarrationStorage } from "./storage";
import type { BookText } from "./text";

/**
 * Chapter tracks: one continuous recording of a chapter in one narrator's voice, assembled from the
 * sentence audio already stored for that narration. Assembling never calls the voice provider and never
 * touches credits; it only reads stored clips and joins them. A track is built once, the first time it
 * is asked for, and kept next to its narration's clips in the same private bucket. Its timing map says
 * exactly where each sentence starts, so the read-along highlight can follow the track's clock.
 */

/** Bumped when the way tracks are joined changes, so older tracks are rebuilt rather than reused. */
const TRACK_FORMAT = 1;

/** Clips fetched at once while a track is assembled. */
const FETCH_AT_ONCE = 8;

export interface TrackSentence {
  sentenceId: string;
  /** The sentence's place in the whole text, as the players count sentences. */
  index: number;
  startMs: number;
  durationMs: number;
}

export interface ChapterTrack {
  id: string;
  chapter: number;
  contentType: string;
  bytes: number;
  durationMs: number;
  sentences: TrackSentence[];
}

export interface TrackPlan {
  id: string;
  chapter: number;
  audioKey: string;
  timingKey: string;
  clips: { sentenceId: string; index: number; storageKey: string; pauseBeforeMs: number }[];
}

/** Where a narration's tracks are kept: a folder beside its sentence clips. */
export function tracksFolder(libraryKey: string): string {
  return `${libraryKey.replaceAll(":", "/")}/tracks`;
}

/**
 * The track for one chapter of a narration, when every sentence in it is ready; null while any isn't,
 * so a track never promises audio that doesn't exist. Its id is a hash of exactly which stored clips it
 * joins (and when each was made), so a sentence prepared again gets a new track instead of a stale one.
 */
export function chapterTrackPlan(state: FamilyState, library: NarrationLibrary, text: BookText, chapter: number): TrackPlan | null {
  const ch = text.chapters.find((c) => c.number === chapter);
  if (!ch || ch.sentenceIds.length === 0) return null;
  const segments = new Map(state.segments.filter((s) => s.libraryKey === library.key).map((s) => [s.sentenceId, s]));
  const indexOf = new Map(text.sentences.map((s, i) => [s.id, i]));
  const all = text.sentences.map((s) => s.text);
  const clips: TrackPlan["clips"] = [];
  const recipe: string[] = [];
  for (const sentenceId of ch.sentenceIds) {
    const seg = segments.get(sentenceId);
    const index = indexOf.get(sentenceId);
    if (seg?.status !== "ready" || !seg.storageKey || index === undefined) return null;
    const pauseBeforeMs = isTheEnd(all, index) ? THE_END_PAUSE_MS : 0;
    clips.push({ sentenceId, index, storageKey: seg.storageKey, pauseBeforeMs });
    recipe.push(`${seg.storageKey}|${seg.readyAt ?? ""}|${pauseBeforeMs}`);
  }
  const id = createHash("sha256").update(JSON.stringify([TRACK_FORMAT, library.key, chapter, recipe])).digest("hex").slice(0, 32);
  const folder = tracksFolder(library.key);
  return { id, chapter, audioKey: `${folder}/${id}.audio`, timingKey: `${folder}/${id}.json`, clips };
}

async function inBatches<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  return out;
}

/** Reads a track already built for this plan, or null. */
async function builtTrack(audio: NarrationStorage, plan: TrackPlan): Promise<ChapterTrack | null> {
  const stored = await audio.get(plan.timingKey);
  if (!stored) return null;
  const track = JSON.parse(new TextDecoder().decode(stored.audio)) as ChapterTrack;
  return track.id === plan.id && (await audio.exists(plan.audioKey)) ? track : null;
}

/**
 * The chapter track for this plan: the stored one, or assembled now from the stored clips and kept.
 * Throws JoinError when the clips can't be joined as they are (for example, made in different formats);
 * callers then keep playing sentence by sentence.
 */
export async function chapterTrack(audio: NarrationStorage, plan: TrackPlan): Promise<ChapterTrack> {
  const built = await builtTrack(audio, plan);
  if (built) return built;
  const clips = await inBatches(plan.clips, FETCH_AT_ONCE, async (c) => {
    const stored = await audio.get(c.storageKey);
    if (!stored) throw new JoinError(`stored audio is missing for sentence ${c.sentenceId}`);
    return { audio: stored.audio, pauseBeforeMs: c.pauseBeforeMs };
  });
  const joined = joinClips(clips);
  const track: ChapterTrack = {
    id: plan.id,
    chapter: plan.chapter,
    contentType: joined.contentType,
    bytes: joined.audio.length,
    durationMs: Math.round(joined.durationMs),
    sentences: plan.clips.map((c, i) => ({
      sentenceId: c.sentenceId,
      index: c.index,
      startMs: Math.round(joined.clips[i]!.startMs),
      durationMs: Math.round(joined.clips[i]!.durationMs),
    })),
  };
  // The audio first: a timing map is only ever stored for audio that is already there.
  const bytes = joined.audio.buffer.slice(joined.audio.byteOffset, joined.audio.byteOffset + joined.audio.byteLength) as ArrayBuffer;
  await audio.put(plan.audioKey, bytes, joined.contentType);
  await audio.put(plan.timingKey, new TextEncoder().encode(JSON.stringify(track)).buffer as ArrayBuffer, "application/json");
  return track;
}

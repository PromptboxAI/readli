/**
 * The list of stories this device keeps for listening offline. Safe for the browser; no I/O here.
 * Audio lives in Cache Storage under `audioKey`; this list says what is there and until when it may play.
 */
import type { Track } from "@/lib/player/tracks";

/** One chapter of a download: its timing map, without a link (the audio is on the device). */
export type OfflineChapter = Omit<Track, "url" | "expiresAt">;

export interface OfflineEntry {
  childId: string;
  bookSlug: string;
  voiceId: string;
  /** The text the download reads. */
  revision: string;
  title: string;
  /** Until when it may play without the device checking in; each check while online renews it. */
  expiresAt: string;
  savedAt: string;
  chapters: OfflineChapter[];
}

export const OFFLINE_CACHE = "readli-offline-audio-v1";
export const MANIFEST_KEY = "readli-offline-v1";

/** Where one chapter's audio is kept in Cache Storage. Never fetched from the network. */
export function audioKey(e: Pick<OfflineEntry, "childId" | "voiceId" | "bookSlug" | "revision">, chapter: number): string {
  return `/offline-audio/${encodeURIComponent(e.childId)}/${encodeURIComponent(e.voiceId)}/${encodeURIComponent(e.bookSlug)}/${encodeURIComponent(e.revision)}/${chapter}`;
}

export function sameDownload(a: Pick<OfflineEntry, "childId" | "voiceId" | "bookSlug">, b: Pick<OfflineEntry, "childId" | "voiceId" | "bookSlug">): boolean {
  return a.childId === b.childId && a.voiceId === b.voiceId && a.bookSlug === b.bookSlug;
}

/** Still allowed to play on this device: checked in within the last week. */
export function playable(e: Pick<OfflineEntry, "expiresAt">, now: number = Date.now()): boolean {
  return Date.parse(e.expiresAt) > now;
}

/** A child's download of a book, in any voice, preferring the one asked for. Expired ones don't count. */
export function findDownload(list: readonly OfflineEntry[], childId: string, bookSlug: string, voiceId: string | null, now: number = Date.now()): OfflineEntry | null {
  const mine = list.filter((e) => e.childId === childId && e.bookSlug === bookSlug && playable(e, now));
  return mine.find((e) => e.voiceId === voiceId) ?? null;
}

/**
 * Applies the server's answer to a check: kept downloads get their new week, the rest are returned to
 * be removed (with their audio). Other children's downloads are untouched.
 */
export function applyCheck(
  list: readonly OfflineEntry[],
  childId: string,
  keep: readonly { voiceId: string; bookSlug: string; revision: string; expiresAt: string }[],
): { list: OfflineEntry[]; removed: OfflineEntry[] } {
  const removed: OfflineEntry[] = [];
  const next: OfflineEntry[] = [];
  for (const e of list) {
    if (e.childId !== childId) {
      next.push(e);
      continue;
    }
    const k = keep.find((x) => x.voiceId === e.voiceId && x.bookSlug === e.bookSlug && x.revision === e.revision);
    if (k) next.push({ ...e, expiresAt: k.expiresAt });
    else removed.push(e);
  }
  return { list: next, removed };
}

/** Downloads past their week that must go, even while the device stays offline. */
export function expired(list: readonly OfflineEntry[], now: number = Date.now()): { list: OfflineEntry[]; removed: OfflineEntry[] } {
  return { list: list.filter((e) => playable(e, now)), removed: list.filter((e) => !playable(e, now)) };
}

export function parseManifest(raw: string | null): OfflineEntry[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? (list.filter((e) => e && typeof e === "object" && typeof (e as OfflineEntry).bookSlug === "string") as OfflineEntry[]) : [];
  } catch {
    return [];
  }
}

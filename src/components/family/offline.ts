/**
 * This device's offline stories: the list in localStorage, the audio in Cache Storage. Browser only.
 * Every function fails quietly where storage is blocked, since offline listening is an extra.
 */
import type { Track } from "@/lib/player/tracks";
import { applyCheck, audioKey, expired, MANIFEST_KEY, OFFLINE_CACHE, parseManifest, sameDownload, type OfflineEntry } from "@/lib/offline/manifest";

export const DOWNLOADS_CHANGED = "readli-downloads-changed";

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window && "localStorage" in window;
}

export function readDownloads(): OfflineEntry[] {
  try {
    return parseManifest(window.localStorage.getItem(MANIFEST_KEY));
  } catch {
    return [];
  }
}

function writeDownloads(list: OfflineEntry[]) {
  try {
    window.localStorage.setItem(MANIFEST_KEY, JSON.stringify(list));
  } catch {
    // Storage is full or blocked; the download simply isn't remembered.
  }
  window.dispatchEvent(new Event(DOWNLOADS_CHANGED));
}

async function dropAudio(entries: OfflineEntry[]) {
  if (!entries.length || !offlineSupported()) return;
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    for (const e of entries) for (const c of e.chapters) await cache.delete(audioKey(e, c.chapter));
  } catch {
    // Nothing more to do.
  }
}

/** Removes one download and its audio. */
export async function removeDownload(e: Pick<OfflineEntry, "childId" | "voiceId" | "bookSlug">) {
  const list = readDownloads();
  const gone = list.filter((x) => sameDownload(x, e));
  writeDownloads(list.filter((x) => !sameDownload(x, e)));
  await dropAudio(gone);
}

/** Removes downloads past their offline week, even with no connection. */
export async function dropExpired(now = Date.now()) {
  const { list, removed } = expired(readDownloads(), now);
  if (!removed.length) return;
  writeDownloads(list);
  await dropAudio(removed);
}

/**
 * Asks the server which of this child's downloads they may still hear. Kept ones get a fresh week; the
 * rest are removed with their audio. Offline, or on a server error, nothing changes.
 */
export async function checkDownloads(childId: string) {
  await dropExpired();
  const mine = readDownloads().filter((e) => e.childId === childId);
  if (!mine.length) return;
  const res = await fetch(`/api/kids/${encodeURIComponent(childId)}/downloads/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: mine.map(({ voiceId, bookSlug, revision }) => ({ voiceId, bookSlug, revision })) }),
    cache: "no-store",
  }).catch(() => null);
  if (!res) return;
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    // This device can't open this child any more: nothing of theirs stays.
    const { list, removed } = applyCheck(readDownloads(), childId, []);
    writeDownloads(list);
    await dropAudio(removed);
    return;
  }
  if (!res.ok) return;
  const body = (await res.json().catch(() => null)) as { keep?: { voiceId: string; bookSlug: string; revision: string; expiresAt: string }[] } | null;
  if (!body?.keep) return;
  const { list, removed } = applyCheck(readDownloads(), childId, body.keep);
  writeDownloads(list);
  await dropAudio(removed);
}

/**
 * Downloads a whole story in one voice to this device. `progress` gets a fraction from 0 to 1. Throws
 * with the server's error code when the story can't be downloaded.
 */
export async function downloadStory(
  childId: string,
  book: { slug: string; title: string },
  voiceId: string,
  progress: (fraction: number) => void,
): Promise<OfflineEntry> {
  const res = await fetch(`/api/kids/${encodeURIComponent(childId)}/downloads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ voiceId, bookSlug: book.slug }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    throw new Error(body?.error?.code ?? "download_failed");
  }
  const grant = (await res.json()) as { bookSlug: string; voiceId: string; revision: string; expiresAt: string; chapters: Track[] };
  const entry: OfflineEntry = {
    childId,
    bookSlug: grant.bookSlug,
    voiceId: grant.voiceId,
    revision: grant.revision,
    title: book.title,
    expiresAt: grant.expiresAt,
    savedAt: new Date().toISOString(),
    chapters: grant.chapters.map((c) => ({ chapter: c.chapter, revision: c.revision, contentType: c.contentType, durationMs: c.durationMs, sentences: c.sentences })),
  };
  const cache = await caches.open(OFFLINE_CACHE);
  let done = 0;
  progress(0);
  for (const c of grant.chapters) {
    const audio = await fetch(c.url, { cache: "no-store" });
    if (!audio.ok) throw new Error("download_failed");
    const blob = await audio.blob();
    await cache.put(audioKey(entry, c.chapter), new Response(blob, { headers: { "content-type": c.contentType, "content-length": String(blob.size) } }));
    done += 1;
    progress(done / grant.chapters.length);
  }
  const others = readDownloads().filter((x) => !sameDownload(x, entry));
  const replaced = readDownloads().filter((x) => sameDownload(x, entry) && x.revision !== entry.revision);
  writeDownloads([...others, entry]);
  await dropAudio(replaced);
  return entry;
}

/** A chapter of a download as a track the player can load, with its audio from this device. */
export async function offlineTrack(e: OfflineEntry, chapter: number): Promise<Track | null> {
  const meta = e.chapters.find((c) => c.chapter === chapter);
  if (!meta || !offlineSupported()) return null;
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    const res = await cache.match(audioKey(e, chapter));
    if (!res) return null;
    const url = URL.createObjectURL(await res.blob());
    return { ...meta, url, expiresAt: e.expiresAt };
  } catch {
    return null;
  }
}

import manifest from "./manifest.json";
import { SNAPSHOTS } from "./snapshots";

/**
 * Published story revisions (Versioned Audiobooks, Kevin 2026-10-21). Every text the app has ever built
 * for a book is kept, so narration prepared from it keeps playing with exactly the words it says, while
 * new preparation uses today's text. Snapshots are written by scripts/revisions/archive.mjs from git
 * history, each built by its own commit's code; they are never edited.
 */
export interface RevisionSnapshot {
  slug: string;
  title: string;
  edition: string;
  revision: string;
  /** The story's own sentences, split as the app split them then; the app adds the closing "The End.". */
  chapters: { title: string; sentences: string[] }[];
}

export interface RevisionInfo {
  slug: string;
  revision: string;
  edition: string;
  firstSeen: string;
  /** When it was last built; null for today's text. */
  lastSeen: string | null;
  /** Ever on main (not only on a preview branch). */
  published: boolean;
  current: boolean;
  sentences: number;
  /** A Readli correction: families with the earlier version get this one without spending credits. */
  correction?: boolean;
}

const REVISIONS = manifest as Record<string, RevisionInfo[]>;

export function revisionsOf(slug: string): RevisionInfo[] {
  return REVISIONS[slug] ?? [];
}

export function revisionInfo(slug: string, revision: string): RevisionInfo | null {
  return revisionsOf(slug).find((r) => r.revision === revision) ?? null;
}

/** An earlier text of a book, exactly as it was built; null for today's text or one never built. */
export function revisionSnapshot(slug: string, revision: string): RevisionSnapshot | null {
  return SNAPSHOTS[`${slug}:${revision}`] ?? null;
}

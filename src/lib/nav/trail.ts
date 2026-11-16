/**
 * The pages this tab has visited on Readli, in the same order as the browser's own history, so a Back
 * link or breadcrumb can return to the page the visitor actually came from (Home, the bookshelf, a
 * book...) instead of a fixed parent page. Kevin asked for this several times (2026-11-16): every Back
 * goes to where you came from, and only falls back to a fixed page when there is nowhere to return to.
 *
 * `entries` mirrors the tab's history entries on this site and `index` is the one showing now. The
 * browser tells us which entry is showing after Back/Forward through the index we keep in history.state.
 */
export type TrailEntry = { url: string; name?: string };
export type Trail = { entries: TrailEntry[]; index: number };

export const TRAIL_MAX = 60;

const pathOf = (url: string) => url.split(/[?#]/)[0] || "/";

/** A new page pushed on top of the current one: anything after it (pages gone Back from) is dropped. */
export function pushEntry(trail: Trail, url: string): Trail {
  const entries = [...trail.entries.slice(0, trail.index + 1), { url }];
  const drop = Math.max(0, entries.length - TRAIL_MAX);
  return { entries: entries.slice(drop), index: entries.length - 1 - drop };
}

/** The current page changed its address without a new history entry (a redirect, a ?voice= change). */
export function replaceEntry(trail: Trail, url: string): Trail {
  if (!trail.entries.length) return { entries: [{ url }], index: 0 };
  const entries = [...trail.entries];
  const was = entries[trail.index];
  entries[trail.index] = { url, name: was && pathOf(was.url) === pathOf(url) ? was.name : undefined };
  return { entries, index: trail.index };
}

/** Back or Forward landed on entry `index`. An index we never saw (another tab's state) starts afresh. */
export function moveTo(trail: Trail, index: number, url: string): Trail {
  if (index < 0 || index >= trail.entries.length || pathOf(trail.entries[index]!.url) !== pathOf(url)) return { entries: [{ url }], index: 0 };
  return replaceEntry({ ...trail, index }, url);
}

/** The current page's own name (a book's title), kept for the Back link of the pages opened from it. */
export function nameEntry(trail: Trail, name: string | null | undefined): Trail {
  const e = trail.entries[trail.index];
  const clean = name?.replace(/\s+/g, " ").trim().slice(0, 60);
  if (!e || !clean || e.name === clean) return trail;
  const entries = [...trail.entries];
  entries[trail.index] = { ...e, name: clean };
  return { entries, index: trail.index };
}

/**
 * Where Back goes from the current page: the nearest earlier entry on a different page, skipping entries
 * that are the same page with another query or anchor (a chosen voice, a tab), and how many steps back
 * it is. Null when this page is where the visitor arrived, so the link uses its fixed fallback.
 */
export function backTarget(trail: Trail): { url: string; label: string; steps: number } | null {
  const here = trail.entries[trail.index];
  if (here === undefined) return null;
  for (let i = trail.index - 1; i >= 0; i--) {
    const e = trail.entries[i]!;
    if (pathOf(e.url) === pathOf(here.url)) continue;
    if (!sameSitePath(e.url)) return null;
    return { url: e.url, label: placeLabel(e.url, e.name), steps: trail.index - i };
  }
  return null;
}

/** Signed-in places, longest first so a nested page wins over its parent. */
const PLACES: [RegExp, string][] = [
  [/^\/home$/, "Home"],
  [/^\/family\/books\/[^/]+\/listen$/, "Listening"],
  [/^\/family\/books\/[^/]+$/, "Book"],
  [/^\/family\/books$/, "Books"],
  [/^\/family\/narrators/, "Family storytellers"],
  [/^\/family\/my-voice/, "My Voice"],
  [/^\/family\/kids\/[^/]+\/storytellers/, "Storytellers"],
  [/^\/family\/kids/, "My Family"],
  [/^\/family\/activity/, "Activity"],
  [/^\/family\/settings\/plan/, "Plan & credits"],
  [/^\/family\/settings\/parents/, "Grown-ups"],
  [/^\/family\/settings\/kids-mode/, "Kids Mode"],
  [/^\/family\/settings/, "Settings"],
  [/^\/family\/setup/, "Setup"],
  [/^\/family$/, "My Family"],
  [/^\/kids\/listen\//, "Listening"],
  [/^\/kids/, "My stories"],
  [/^\/voice\/record/, "Recording"],
  [/^\/voice\/setup/, "Setup"],
  [/^\/voice/, "My Voice"],
  [/^\/books\/[^/]+$/, "Book"],
  [/^\/books/, "The Readli Library"],
  [/^\/bedtime-stories\/[^/]+$/, "Bedtime story"],
  [/^\/bedtime-stories/, "Bedtime stories"],
  [/^\/guides\/[^/]+$/, "Guide"],
  [/^\/guides/, "Stories & Guides"],
  [/^\/help/, "Help"],
  [/^\/pricing/, "Pricing"],
  [/^\/admin\/email/, "Email"],
  [/^\/admin\/[^/]+/, "Admin"],
  [/^\/admin$/, "Admin overview"],
  [/^\/$/, "Readli home"],
];

/** Places named after what they show (a book, a story), where the page's own heading is the better label. */
const NAMED_BY_PAGE = new Set(["Book", "Listening", "Bedtime story", "Guide"]);

/** A short name for the page at `url`, for the Back link's label; "Back" when it isn't a named place. */
export function placeLabel(url: string, name?: string): string {
  const path = pathOf(url);
  if (path === "/family" && url.includes("#bookshelf")) return "Family bookshelf";
  const place = PLACES.find(([re]) => re.test(path))?.[1];
  if (place && NAMED_BY_PAGE.has(place) && name) return name;
  return place ?? "Back";
}

/** Only a plain same-site path can be a Back target. */
export function sameSitePath(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

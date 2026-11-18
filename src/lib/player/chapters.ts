/**
 * Chapters as the players show them: the chapter pill under the title, the chapter sheet it opens, and
 * the lock screen's previous and next track buttons, which move a chapter at a time.
 */

export interface PlayerChapter {
  number: number;
  title: string;
  /** Index of the chapter's first sentence. */
  start: number;
  /** "ready": every sentence has audio; "partial": it starts but stops partway; "none": not read yet. */
  status: "ready" | "partial" | "none";
}

/**
 * Each chapter of a text, in order, with how much of it this storyteller has read. `chapters` holds the
 * chapter number of every sentence and `ready` says whether a sentence has audio. A chapter can be
 * played from the sheet when its first sentence has audio.
 */
export function chapterList(chapters: readonly number[], titles: readonly string[] | undefined, ready: (at: number) => boolean): PlayerChapter[] {
  const list: PlayerChapter[] = [];
  let all = true;
  chapters.forEach((n, at) => {
    if (at === 0 || n !== chapters[at - 1]) {
      if (list.length) list[list.length - 1]!.status = finish(list[list.length - 1]!.status, all);
      list.push({ number: n, title: titles?.[n - 1] ?? "", start: at, status: ready(at) ? "partial" : "none" });
      all = true;
    }
    if (!ready(at)) all = false;
  });
  if (list.length) list[list.length - 1]!.status = finish(list[list.length - 1]!.status, all);
  return list;
}

function finish(status: PlayerChapter["status"], all: boolean): PlayerChapter["status"] {
  return status === "partial" && all ? "ready" : status;
}

/** Whether a book has more than one chapter, so the pill and sheet are worth showing. */
export function hasChapters(chapters: readonly number[]): boolean {
  return chapters.length > 0 && chapters[0] !== chapters[chapters.length - 1];
}

/** The chapter that holds sentence `at`. */
export function chapterAt(list: readonly PlayerChapter[], at: number): PlayerChapter | null {
  let found: PlayerChapter | null = null;
  for (const c of list) {
    if (c.start > at) break;
    found = c;
  }
  return found;
}

/**
 * Where the lock screen's previous button goes: the start of this chapter, or the chapter before when
 * the story is still on this chapter's first sentence or two, the way audiobook apps do. Only a chapter
 * whose start has audio; null when there's nowhere to go.
 */
export function previousChapterStart(list: readonly PlayerChapter[], at: number): number | null {
  const here = chapterAt(list, at);
  if (!here) return null;
  const i = list.indexOf(here);
  const before = list[i - 1];
  if (at - here.start <= 1 && before && before.status !== "none") return before.start;
  return here.status !== "none" ? here.start : null;
}

/** Where the lock screen's next button goes: the next chapter's start, when it has audio. */
export function nextChapterStart(list: readonly PlayerChapter[], at: number): number | null {
  const next = list.find((c) => c.start > at);
  return next && next.status !== "none" ? next.start : null;
}

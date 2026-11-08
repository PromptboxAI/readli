import { describe, expect, it } from "vitest";
import { chapterAt, chapterList, hasChapters, nextChapterStart, previousChapterStart } from "./chapters";

const chapters = [1, 1, 1, 2, 2, 3, 3, 3];
const titles = ["Down the Rabbit-Hole", "The Pool of Tears", "A Caucus-Race"];
const readyUpTo = (n: number) => (at: number) => at < n;

describe("the chapter sheet", () => {
  it("lists each chapter with its title and first sentence", () => {
    const list = chapterList(chapters, titles, () => true);
    expect(list.map((c) => [c.number, c.title, c.start, c.status])).toEqual([
      [1, "Down the Rabbit-Hole", 0, "ready"],
      [2, "The Pool of Tears", 3, "ready"],
      [3, "A Caucus-Race", 5, "ready"],
    ]);
  });

  it("only offers chapters this storyteller has started reading", () => {
    // Chapter 1 is read, chapter 2 stops partway, chapter 3 isn't read yet.
    expect(chapterList(chapters, titles, readyUpTo(4)).map((c) => c.status)).toEqual(["ready", "partial", "none"]);
    expect(chapterList(chapters, titles, () => false).map((c) => c.status)).toEqual(["none", "none", "none"]);
  });

  it("copes with texts that have no titles", () => {
    expect(chapterList(chapters, undefined, () => true)[0]!.title).toBe("");
  });

  it("is only worth showing for a book with more than one chapter", () => {
    expect(hasChapters(chapters)).toBe(true);
    expect(hasChapters([1, 1, 1])).toBe(false);
    expect(hasChapters([])).toBe(false);
  });

  it("knows which chapter a sentence is in", () => {
    const list = chapterList(chapters, titles, () => true);
    expect(chapterAt(list, 0)!.number).toBe(1);
    expect(chapterAt(list, 4)!.number).toBe(2);
    expect(chapterAt(list, 7)!.number).toBe(3);
  });
});

describe("the lock screen's previous and next track", () => {
  const list = chapterList(chapters, titles, () => true);

  it("goes to the next chapter", () => {
    expect(nextChapterStart(list, 0)).toBe(3);
    expect(nextChapterStart(list, 4)).toBe(5);
    expect(nextChapterStart(list, 6)).toBeNull();
  });

  it("goes back to the start of this chapter, or the one before at its very start", () => {
    expect(previousChapterStart(list, 7)).toBe(5);
    expect(previousChapterStart(list, 5)).toBe(3);
    expect(previousChapterStart(list, 6)).toBe(3);
    expect(previousChapterStart(list, 1)).toBe(0);
  });

  it("never goes to a chapter that isn't read yet", () => {
    const partly = chapterList(chapters, titles, readyUpTo(4));
    expect(nextChapterStart(partly, 3)).toBeNull();
    expect(nextChapterStart(partly, 0)).toBe(3);
  });
});

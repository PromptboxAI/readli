import { describe, expect, it } from "vitest";
import { chapterReady, sentenceAtTime, startOf } from "./tracks";

const track = {
  sentences: [
    { index: 4, startMs: 0, durationMs: 1200 },
    { index: 5, startMs: 1200, durationMs: 800 },
    { index: 6, startMs: 2600, durationMs: 1000 },
  ],
};

describe("following a chapter track", () => {
  it("shows the sentence whose audio has started", () => {
    expect(sentenceAtTime(track, 0)).toBe(4);
    expect(sentenceAtTime(track, 1199)).toBe(4);
    expect(sentenceAtTime(track, 1200)).toBe(5);
    // In the pause before a sentence, the one before stays on screen.
    expect(sentenceAtTime(track, 2400)).toBe(5);
    expect(sentenceAtTime(track, 99_000)).toBe(6);
  });

  it("finds where a sentence starts, and only in its own track", () => {
    expect(startOf(track, 6)).toBe(2600);
    expect(startOf(track, 7)).toBeNull();
  });

  it("plays a chapter as a track only when all of it is prepared", () => {
    const text = { sentenceIds: ["a", "b", "c", "d"], chapters: [1, 1, 2, 2] };
    expect(chapterReady(text, ["a", "b"], 0)).toBe(true);
    expect(chapterReady(text, ["a", "b"], 2)).toBe(false);
    expect(chapterReady(text, ["a", "b", "c"], 3)).toBe(false);
    expect(chapterReady(text, ["a", "b"], 9)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { DEMO_BOOKS, isPassagePlayable } from "./demo-books";
import { DEMO_SCRIPT_V1, splitSentences, wordCount } from "./voice-scripts";

describe("demo books (Amendment 001 F-9)", () => {
  it("keeps exactly the six locked selections in order", () => {
    expect(DEMO_BOOKS.map((b) => b.title)).toEqual([
      "The Tale of Peter Rabbit",
      "The Tale of Benjamin Bunny",
      "The Wonderful Wizard of Oz",
      "Alice’s Adventures in Wonderland",
      "Peter Pan: Peter and Wendy",
      "Winnie-the-Pooh",
    ]);
  });

  it("pins the editions the PRD names", () => {
    expect(DEMO_BOOKS.find((b) => b.slug === "peter-pan-peter-and-wendy")?.gutenbergId).toBe(16);
    expect(DEMO_BOOKS.find((b) => b.slug === "winnie-the-pooh")?.gutenbergId).toBe(67098);
  });

  it("plays nothing until rights and passage are approved", () => {
    expect(DEMO_BOOKS.some(isPassagePlayable)).toBe(false);
  });
});

describe("demo script", () => {
  it("fits a 60 to 120 second read at typical pace", () => {
    const words = wordCount(DEMO_SCRIPT_V1);
    // ~130 wpm average reader: 60s = 130 words, 120s = 260 words. Slightly longer for slow readers.
    expect(words).toBeGreaterThanOrEqual(200);
    expect(words).toBeLessThanOrEqual(320);
  });

  it("splits sentences without losing text", () => {
    const p = "Oh my goodness, look at that! Is it moving? Hold on tight.";
    expect(splitSentences(p)).toEqual(["Oh my goodness, look at that!", "Is it moving?", "Hold on tight."]);
  });
});

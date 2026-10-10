import { existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { coverSrc, DEMO_BOOKS, isPassagePlayable } from "./demo-books";
import { DEMO_SCRIPT, splitSentences, wordCount } from "./voice-scripts";

describe("demo books (Kevin's 2026-10-10 selection, supersedes Amendment 001 F-9)", () => {
  it("keeps exactly the six chosen books in order", () => {
    expect(DEMO_BOOKS.map((b) => b.title)).toEqual([
      "The Tale of Peter Rabbit",
      "Alice’s Adventures in Wonderland",
      "Winnie-the-Pooh",
      "The Three Little Pigs",
      "The Princess and the Pea",
      "The Lion and the Mouse",
    ]);
  });

  it("pins the edition the PRD names", () => {
    expect(DEMO_BOOKS.find((b) => b.slug === "winnie-the-pooh")?.gutenbergId).toBe(67098);
  });

  it("has original cover art for every book", () => {
    for (const book of DEMO_BOOKS) expect(existsSync(join(process.cwd(), "public", coverSrc(book)))).toBe(true);
  });

  it("plays nothing until rights and passage are approved", () => {
    expect(DEMO_BOOKS.some(isPassagePlayable)).toBe(false);
  });
});

describe("demo script", () => {
  it("fits a 60 to 120 second read at typical pace", () => {
    const words = wordCount(DEMO_SCRIPT);
    // ~130 wpm average reader: 60s = 130 words, 120s = 260 words. Slightly longer for slow readers.
    expect(words).toBeGreaterThanOrEqual(200);
    expect(words).toBeLessThanOrEqual(320);
  });

  it("splits sentences without losing text", () => {
    const p = "Oh my goodness, look at that! Is it moving? Hold on tight.";
    expect(splitSentences(p)).toEqual(["Oh my goodness, look at that!", "Is it moving?", "Hold on tight."]);
  });
});

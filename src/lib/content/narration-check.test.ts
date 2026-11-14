import { describe, expect, it } from "vitest";
import { CATALOG } from "@/lib/library/catalog";
import { countByIssue, NARRATION_ADVICE, scanNarration, type NarrationIssue } from "./narration-check";
import { sentencesOf } from "./sentences";

const scan = (text: string) => scanNarration([{ title: "", text }]).map((f) => f.issue);

/** Findings that read fine aloud, by book, with why they stay. */
const NARRATION_REVIEW: Record<string, Partial<Record<NarrationIssue, number>>> = {
  // Pencils marked "HB" and "BB" are read as letters, which is what they are.
  "winnie-the-pooh": { shouting: 1 },
};

describe("narration scanner", () => {
  it("flags the lines that went wrong in Billy Goats Gruff", () => {
    expect(scan("“Oh! it is only I,” said the billy-goat, with such a small voice.")).toEqual(["quiet-cue"]);
    expect(scan("“TRIP, TRAP! TRIP, TRAP! TRIP, TRAP!” went the bridge.")).toEqual([
      "shouting",
      "repeated-fragment",
      "shouting",
      "repeated-fragment",
      "shouting",
    ]);
    expect(scan("“Caw! Caw!” Down they flew.")).toEqual(["repeated-fragment", "repeated-fragment"]);
    expect(scan("said the Little Wee Bear in his little wee voice.")).toEqual(["quiet-cue"]);
    expect(scan("Hush!” said the Rabbit in a low, hurried tone.")).toEqual(["quiet-cue"]);
    expect(scan("BANG!!!???***!!!")).toEqual(["shouting", "symbols"]);
  });

  it("leaves ordinary lines alone", () => {
    expect(scan("“Trip, trap, trip, trap!” went his little hooves on the bridge.")).toEqual([]);
    expect(scan("“Ha!” said Pooh. “Is that you, Piglet?” Chapter VII begins. Little pig! No!")).toEqual([]);
    expect(scan("She went quietly to bed, and the house was still.")).toEqual([]);
  });

  it("splits sentences the way the player does", () => {
    const text = "“TRIP, TRAP!” went Mrs. Gruff. Then they slept.";
    expect(scanNarration([{ title: "", text }]).map((f) => f.sentence)).toEqual([sentencesOf(text)[0]]);
  });

  it("explains every issue", () => {
    for (const advice of Object.values(NARRATION_ADVICE)) expect(advice).toBeTruthy();
  });

  // Kevin, 2026-10-23: every book is checked for lines the voice model misreads before it is narrated.
  // A new or edited book fails here until the lines are rewritten (node scripts/language-scan.mjs <book.json>
  // prints them) or recorded above with why they stay.
  it.each(CATALOG.map((b) => [b.slug, b] as const))("%s has no lines the narrator would misread", (slug, book) => {
    expect(countByIssue(scanNarration(book.chapters))).toEqual(NARRATION_REVIEW[slug] ?? {});
  });

  it("only reviews books in the catalog", () => {
    const slugs = new Set(CATALOG.map((b) => b.slug));
    for (const slug of Object.keys(NARRATION_REVIEW)) expect(slugs).toContain(slug);
  });
});

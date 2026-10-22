import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CATALOG } from "@/lib/library/catalog";
import { isTheEnd, saysTheEnd, THE_END } from "@/lib/content/the-end";
import { bookText, withoutTheEnd } from "./text";

describe("every story closes with The End", () => {
  it("adds The End. as its own last sentence of the last chapter, once", () => {
    for (const book of CATALOG) {
      const text = bookText(book.slug)!;
      const last = text.sentences.at(-1)!;
      expect(last.text, book.slug).toBe(THE_END);
      expect(text.sentences.filter((s) => saysTheEnd(s.text)), book.slug).toHaveLength(1);
      expect(last.chapter).toBe(text.chapters.length);
      expect(text.chapters.at(-1)!.sentenceIds.at(-1)).toBe(last.id);
      expect(isTheEnd(text.sentences.map((s) => s.text), text.sentences.length - 1)).toBe(true);
    }
  });

  it("keeps the revision, so sentence ids and prepared audio are unchanged", () => {
    const book = CATALOG[0]!;
    const revision = createHash("sha256").update(book.chapters.map((c) => c.text).join("\n\n")).digest("hex").slice(0, 12);
    expect(bookText(book.slug)!.revision).toBe(revision);
  });

  it("recognizes a closing The End in any case or punctuation", () => {
    expect(saysTheEnd("The End.")).toBe(true);
    expect(saysTheEnd("THE END!")).toBe(true);
    expect(saysTheEnd("And that is the end of the story.")).toBe(false);
    expect(isTheEnd(["Once.", THE_END], 0)).toBe(false);
  });

  it("can set The End aside for audio prepared before it was added", () => {
    const text = bookText(CATALOG[0]!.slug)!;
    const story = withoutTheEnd(text);
    expect(story.sentences).toHaveLength(text.sentences.length - 1);
    expect(story.chapters.flatMap((c) => c.sentenceIds)).toEqual(story.sentences.map((s) => s.id));
  });
});

describe("long stories split into parts", () => {
  // Revisions and sentence counts from before the split: splitting at a paragraph keeps every sentence id.
  const SPLIT = [
    ["the-ugly-duckling", "0e718ff695f9", 106, 4],
    ["thumbelina", "81e49318a6ca", 201, 4],
    ["the-velveteen-rabbit", "32815e09f55b", 214, 4],
    ["cinderella", "e41d91f4209f", 100, 2],
    ["the-emperors-new-clothes", "ddc67a3e0e27", 97, 2],
  ] as const;

  it("can be prepared a part at a time, and audio already prepared still lines up", () => {
    for (const [slug, revision, sentences, parts] of SPLIT) {
      const text = bookText(slug)!;
      expect(text.chapters, slug).toHaveLength(parts);
      expect(text.revision, slug).toBe(revision);
      expect(text.sentences, slug).toHaveLength(sentences + 1);
    }
  });
});

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COLLECTIONS, collectionBooks, collectionsFor } from "./collections";
import { publicLibrary } from "./public";

const library = publicLibrary();

describe("bedtime story collections", () => {
  it("have unique slugs and enough books to be worth a page", () => {
    expect(new Set(COLLECTIONS.map((c) => c.slug)).size).toBe(COLLECTIONS.length);
    for (const c of COLLECTIONS) expect(collectionBooks(c, library).length, c.slug).toBeGreaterThanOrEqual(3);
  });

  // Spanish samples need ElevenLabs (scripts/book-samples.mjs); until Ratón Pérez's is recorded its page
  // simply shows no sample box. Remove it from this list once public/samples/books/raton-perez.mp3 exists.
  const SAMPLE_PENDING = new Set(["raton-perez"]);

  it("feature a book that is in the collection and has a recorded sample", () => {
    for (const c of COLLECTIONS) {
      expect(collectionBooks(c, library).some((b) => b.slug === c.featured), c.slug).toBe(true);
      const recorded = existsSync(join(process.cwd(), "public", "samples", "books", `${c.featured}.mp3`));
      expect(recorded, c.featured).toBe(!SAMPLE_PENDING.has(c.featured));
    }
  });

  it("gather the Spanish books on their own shelf, out of the English ones", () => {
    const spanish = library.filter((b) => b.language === "es").map((b) => b.slug);
    expect(spanish.sort()).toEqual(["cuentos-de-la-edad-de-oro", "fabulas-de-samaniego", "raton-perez"]);
    for (const b of library.filter((b) => b.language === "es")) {
      expect(collectionsFor(b).map((c) => c.slug), b.slug).toEqual(["cuentos-en-espanol"]);
    }
  });

  it("keep search snippets short and give every page its own writing and questions", () => {
    for (const c of COLLECTIONS) {
      expect(c.description.length, c.slug).toBeLessThanOrEqual(170);
      expect(c.intro.length, c.slug).toBeGreaterThanOrEqual(2);
      expect(c.faqs.length, c.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it("keep short stories to five minutes and leave the nursery rhymes out of the fairy tales", () => {
    const short = COLLECTIONS.find((c) => c.slug === "short-bedtime-stories")!;
    for (const b of collectionBooks(short, library)) expect(b.minutes, b.slug).toBeLessThanOrEqual(5);
    const tales = COLLECTIONS.find((c) => c.slug === "fairy-tales")!;
    expect(collectionBooks(tales, library).map((b) => b.slug)).not.toContain("the-real-mother-goose");
  });

  it("put most books in at least one collection", () => {
    const placed = library.filter((b) => collectionsFor(b).length > 0).length;
    expect(placed / library.length).toBeGreaterThan(0.9);
  });
});

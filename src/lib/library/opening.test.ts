import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { bookOpening } from "./opening";

describe("bookOpening", () => {
  it("starts with the story's own first words", () => {
    const opening = bookOpening("the-tale-of-peter-rabbit");
    expect(opening[0]).toBe("Once upon a time there were four little Rabbits, and their names were—");
    expect(opening.length).toBeGreaterThan(1);
    expect(opening.length).toBeLessThanOrEqual(3);
  });

  it("keeps verse line breaks", () => {
    expect(bookOpening("the-owl-and-the-pussy-cat")[0]).toContain("\n");
  });

  it("gives every catalog book a short opening", () => {
    for (const b of CATALOG) {
      const opening = bookOpening(b.slug);
      expect(opening.length, b.slug).toBeGreaterThan(0);
      expect(opening.join(" ").length, b.slug).toBeLessThan(1300);
    }
  });

  it("is empty for a book Readli doesn't have", () => {
    expect(bookOpening("not-a-book")).toEqual([]);
  });
});

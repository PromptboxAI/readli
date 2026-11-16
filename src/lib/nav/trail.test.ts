import { describe, expect, it } from "vitest";
import { backTarget, moveTo, nameEntry, placeLabel, pushEntry, replaceEntry, TRAIL_MAX, type Trail } from "./trail";

const start = (url: string): Trail => ({ entries: [{ url }], index: 0 });

describe("the way back", () => {
  it("returns Home from a listen page opened from Home's Play, not to the book page", () => {
    const t = pushEntry(start("/home"), "/family/books/the-lion-and-the-mouse/listen");
    expect(backTarget(t)).toEqual({ url: "/home", label: "Home", steps: 1 });
  });

  it("returns to the book page when the listen page was opened from it, named after the book", () => {
    let t = pushEntry(start("/home"), "/family/books/the-lion-and-the-mouse");
    t = nameEntry(t, "The Lion and the Mouse");
    t = pushEntry(t, "/family/books/the-lion-and-the-mouse/listen");
    expect(backTarget(t)).toMatchObject({ url: "/family/books/the-lion-and-the-mouse", label: "The Lion and the Mouse", steps: 1 });
    // Back on the book page, its breadcrumb goes on back to Home.
    t = moveTo(t, 1, "/family/books/the-lion-and-the-mouse");
    expect(backTarget(t)).toMatchObject({ url: "/home", label: "Home", steps: 1 });
  });

  it("uses the page's fixed link when the visitor arrived there directly", () => {
    expect(backTarget(start("/family/books/the-lion-and-the-mouse/listen"))).toBeNull();
  });

  it("skips entries on the same page (a chosen voice, an anchor) and steps back past them", () => {
    let t = pushEntry(start("/family"), "/family/books/peter-rabbit");
    t = pushEntry(t, "/family/books/peter-rabbit?voice=a");
    t = pushEntry(t, "/family/books/peter-rabbit?voice=b");
    expect(backTarget(t)).toMatchObject({ url: "/family", label: "My Family", steps: 3 });
  });

  it("drops the pages gone Back from when a new page opens", () => {
    let t = pushEntry(pushEntry(start("/home"), "/family"), "/family/narrators");
    t = moveTo(t, 0, "/home");
    t = pushEntry(t, "/family/books");
    expect(t.entries.map((e) => e.url)).toEqual(["/home", "/family/books"]);
  });

  it("keeps a redirect or query change on the same entry", () => {
    const t = replaceEntry(pushEntry(start("/home"), "/family/setup"), "/family/setup?step=book");
    expect(t.entries.map((e) => e.url)).toEqual(["/home", "/family/setup?step=book"]);
  });

  it("starts afresh on an entry it never saw", () => {
    expect(moveTo(start("/home"), 4, "/books")).toEqual(start("/books"));
    expect(moveTo(pushEntry(start("/home"), "/family"), 1, "/books")).toEqual(start("/books"));
  });

  it("stays bounded", () => {
    let t = start("/p0");
    for (let i = 1; i < TRAIL_MAX + 20; i++) t = pushEntry(t, `/p${i}`);
    expect(t.entries).toHaveLength(TRAIL_MAX);
    expect(backTarget(t)?.steps).toBe(1);
  });

  it("names places for the link's label", () => {
    expect(placeLabel("/family#bookshelf")).toBe("Family bookshelf");
    expect(placeLabel("/family/books")).toBe("Books");
    expect(placeLabel("/family/books/x")).toBe("Book");
    expect(placeLabel("/family/books/x", "Heidi")).toBe("Heidi");
    expect(placeLabel("/family/settings/plan?from=/home")).toBe("Plan & credits");
    expect(placeLabel("/somewhere-new")).toBe("Back");
  });
});

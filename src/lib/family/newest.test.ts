import { describe, expect, it } from "vitest";
import { isNewOnFamilyShelf } from "./newest";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const TODAY = "2026-11-10T09:00:00Z";

describe("Family bookshelf New badge", () => {
  it("stays while any child hasn't finished the book, started or not", () => {
    expect(isNewOnFamilyShelf(TODAY, [null], NOW)).toBe(true);
    expect(isNewOnFamilyShelf(TODAY, [40], NOW)).toBe(true);
    expect(isNewOnFamilyShelf(TODAY, [100, null], NOW)).toBe(true);
    expect(isNewOnFamilyShelf(TODAY, [], NOW)).toBe(true);
  });

  it("goes once every child has finished it, or after two weeks", () => {
    expect(isNewOnFamilyShelf(TODAY, [100, 100], NOW)).toBe(false);
    expect(isNewOnFamilyShelf("2026-10-20T09:00:00Z", [null], NOW)).toBe(false);
  });
});

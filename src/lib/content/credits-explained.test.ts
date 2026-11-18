import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN } from "@/lib/family/plan";
import { publicBook, publicLibrary } from "@/lib/library/public";
import { bookCredits, monthsOfCredits, storiesPerMonth, typicalStoryCredits } from "./credits-explained";

const per = DEFAULT_PLAN.charactersPerCredit;

describe("credits in bedtime terms", () => {
  it("rounds a book up to whole credits, never below one", () => {
    expect(bookCredits(1, 1000)).toBe(1);
    expect(bookCredits(1000, 1000)).toBe(1);
    expect(bookCredits(1001, 1000)).toBe(2);
  });

  it("prices real books from their text", () => {
    const rabbit = publicBook("the-tale-of-peter-rabbit")!;
    expect(bookCredits(rabbit.characters!, per)).toBe(Math.ceil(rabbit.characters! / per));
    const heidi = publicBook("heidi")!;
    expect(bookCredits(heidi.characters!, per)).toBeGreaterThan(DEFAULT_PLAN.monthlyCredits);
  });

  it("turns the monthly credits into a handful of picture books", () => {
    const library = publicLibrary();
    const typical = typicalStoryCredits(library, per);
    expect(typical).toBeGreaterThan(1);
    expect(typical).toBeLessThan(DEFAULT_PLAN.monthlyCredits);
    expect(storiesPerMonth(DEFAULT_PLAN.monthlyCredits, library, per)).toBe(Math.floor(DEFAULT_PLAN.monthlyCredits / typical));
  });

  it("leaves coming-soon books out", () => {
    expect(publicLibrary().filter((b) => b.comingSoon).every((b) => b.characters === null)).toBe(true);
  });

  it("says how many months a long book takes", () => {
    expect(monthsOfCredits(267, 40)).toBe(7);
    expect(monthsOfCredits(10, 40)).toBe(1);
  });
});

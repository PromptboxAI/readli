import { describe, expect, it } from "vitest";
import { GUIDES } from "@/lib/guides/guides";
import { HELP_CATEGORIES } from "@/lib/help/articles";
import { visibleArticles } from "@/lib/help/search";
import { publicLibrary } from "@/lib/library/public";
import CONTENT_DATES from "./content-dates.json";
import { publicPages } from "./pages";
import { PAGE_TITLES, TITLE_MAX, TITLE_MIN, bookTitle, fitTitle, guideTitle, helpArticleTitle, helpCategoryTitle } from "./titles";

describe("page titles", () => {
  const titles = [
    ...Object.values(PAGE_TITLES),
    ...publicLibrary().map(bookTitle),
    ...GUIDES.map(guideTitle),
    ...HELP_CATEGORIES.map(helpCategoryTitle),
    ...visibleArticles(false).map(helpArticleTitle),
  ];

  it("are 30 to 60 characters long", () => {
    expect(titles.filter((t) => t.length < TITLE_MIN || t.length > TITLE_MAX)).toEqual([]);
  });

  it("are all different", () => {
    expect(titles.filter((t, i) => titles.indexOf(t) !== i)).toEqual([]);
  });

  it("drop the brand before a long title would be cut", () => {
    expect(fitTitle(["A very long name for a storybook that goes on | Readli Library", "A very long name for a storybook that goes on"])).toBe(
      "A very long name for a storybook that goes on",
    );
  });
});

describe("sitemap dates", () => {
  it("cover every public page, so a new page gets one (run npm run seo:dates)", () => {
    const dates: Record<string, string> = CONTENT_DATES;
    const missing = publicPages().filter((p) => !/^\d{4}-\d{2}-\d{2}$/.test(dates[p.path] ?? "")).map((p) => p.path);
    expect(missing).toEqual([]);
  });
});

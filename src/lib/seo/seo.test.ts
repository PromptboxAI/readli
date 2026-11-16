import { describe, expect, it } from "vitest";
import { COMPARISON_NAMES } from "@/lib/content/comparisons";
import { GUIDES } from "@/lib/guides/guides";
import { HELP_CATEGORIES } from "@/lib/help/articles";
import { visibleArticles } from "@/lib/help/search";
import { COLLECTIONS } from "@/lib/library/collections";
import { publicLibrary } from "@/lib/library/public";
import CONTENT_DATES from "./content-dates.json";
import { publicPages } from "./pages";
import { PAGE_TITLES, TITLE_MAX, TITLE_MIN, DESCRIPTION_MAX, bookDescription, bookTitle, fitTitle, collectionTitle, comparisonTitle, guideTitle, helpArticleTitle, helpCategoryTitle } from "./titles";

describe("page titles", () => {
  const titles = [
    ...Object.values(PAGE_TITLES),
    ...publicLibrary().map(bookTitle),
    ...GUIDES.map(guideTitle),
    ...COLLECTIONS.map(collectionTitle),
    ...Object.values(COMPARISON_NAMES).map((name) => comparisonTitle({ name })),
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

describe("book descriptions", () => {
  const books = publicLibrary();
  const descriptions = books.map(bookDescription);

  it("are all different and short enough not to be cut off in search results", () => {
    expect(descriptions.filter((d, i) => descriptions.indexOf(d) !== i)).toEqual([]);
    expect(descriptions.filter((d) => d.length > DESCRIPTION_MAX)).toEqual([]);
  });

  it("read naturally for folk tales and retellings, and leave out the publication year", () => {
    expect(descriptions.filter((d) => /by Traditional|by Retold|first published/i.test(d))).toEqual([]);
    expect(bookDescription({ title: "The Little Red Hen", author: "Traditional", minutes: 3, chapters: ["The Little Red Hen"], comingSoon: false })).toBe(
      "The Little Red Hen, a traditional tale, read aloud in about 3 minutes. Hear it in the voices of the people your kids love with Readli.",
    );
    expect(bookDescription({ title: "The Three Little Pigs", author: "Traditional, from Joseph Jacobs' English Fairy Tales", minutes: 7, chapters: [], comingSoon: false })).toMatch(
      /^The Three Little Pigs, a traditional tale from Joseph Jacobs' English Fairy Tales, read aloud in about 7 minutes/,
    );
    expect(bookDescription({ title: "The Lion and the Mouse", author: "Aesop", minutes: 1.2, chapters: [], comingSoon: false })).toMatch(/read aloud in about 1 minute\./);
    expect(bookDescription({ title: "Aesop's Fables", author: "Retold by Readli", minutes: 20, chapters: ["a", "b"], comingSoon: false })).toBe(
      "Aesop's Fables, retold by Readli, read aloud in about 20 minutes across 2 chapters. Hear it in the voices of the people your kids love with Readli.",
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

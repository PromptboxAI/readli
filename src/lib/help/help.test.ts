import { describe, expect, it } from "vitest";
import { HELP_ARTICLES, HELP_CATEGORIES } from "./articles";
import { getArticle, relatedArticles, searchHelp, showDrafts, visibleArticles } from "./search";

describe("help content", () => {
  it("gives every article a unique slug in a real category", () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const cats = new Set(HELP_CATEGORIES.map((c) => c.slug));
    for (const a of HELP_ARTICLES) expect(cats.has(a.category)).toBe(true);
  });

  it("only relates to articles that exist", () => {
    for (const a of HELP_ARTICLES) for (const r of a.related ?? []) expect(slugs()).toContain(r);
  });

  it("keeps technical terms out of answers", () => {
    const banned = /\b(api|supabase|tts|elevenlabs|voice[- ]?id|model id)\b/i;
    for (const a of HELP_ARTICLES) expect(a.question + a.answer.join(" ")).not.toMatch(banned);
  });

  it("covers every topic in Kevin's list (42 questions), plus what happens after the demo", () => {
    expect(HELP_ARTICLES).toHaveLength(43);
    expect(visibleArticles(true)).toHaveLength(43);
    expect(visibleArticles(false).length).toBeLessThan(43);
  });

  it("states a timeframe for deleting a voice by email", () => {
    const answer = HELP_ARTICLES.find((a) => a.slug === "replace-or-delete-my-voice")!.answer.join(" ");
    expect(answer).toMatch(/within 48 hours/);
  });
});

describe("drafts", () => {
  it("hides drafts on the production site and shows them in previews", () => {
    expect(showDrafts({ VERCEL_ENV: "production", NODE_ENV: "production" })).toBe(false);
    expect(showDrafts({ VERCEL_ENV: "preview", NODE_ENV: "production" })).toBe(true);
    expect(showDrafts({ NODE_ENV: "development" })).toBe(true);
    expect(showDrafts({ NODE_ENV: "production" })).toBe(false);
    expect(showDrafts({ VERCEL_ENV: "production", HELP_SHOW_DRAFTS: "1" })).toBe(true);
    expect(showDrafts({ NODE_ENV: "development", HELP_SHOW_DRAFTS: "0" })).toBe(false);
  });

  it("does not find, link or search drafts when they are hidden", () => {
    expect(getArticle("billing-credits-and-gifts", "gift-memberships", false)).toBeUndefined();
    expect(getArticle("billing-credits-and-gifts", "gift-memberships", true)).toBeDefined();
    expect(searchHelp("gift", false).every((a) => a.status === "published")).toBe(true);
    const what = getArticle("getting-started", "what-is-readli", false)!;
    expect(relatedArticles(what, false).every((a) => a.status === "published")).toBe(true);
  });
});

describe("searchHelp", () => {
  it("finds relevant articles first", () => {
    expect(searchHelp("microphone", false)[0]?.slug).toBe("microphone-not-recording");
    expect(searchHelp("mic not working", false)[0]?.slug).toBe("microphone-not-recording");
    expect(searchHelp("delete my data", false)[0]?.slug).toBe("data-deletion");
    expect(searchHelp("price", false)[0]?.slug).toBe("family-plan-included");
    expect(searchHelp("grandpa", false)[0]?.slug).toBe("grandpa-pay-to-share");
    expect(searchHelp("cancel subscription", true)[0]?.slug).toBe("manage-or-cancel-subscription");
  });

  it("returns nothing for empty or unrelated queries", () => {
    expect(searchHelp("   ", true)).toEqual([]);
    expect(searchHelp("the a of", true)).toEqual([]);
    expect(searchHelp("xylophone", true)).toEqual([]);
  });
});

function slugs() {
  return HELP_ARTICLES.map((a) => a.slug);
}

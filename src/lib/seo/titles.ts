/**
 * Page titles (SEO audit c_title, 2026-11-13): every public page gets its own title of 30–60 characters,
 * main term first. Fixed pages are written out here; pages built from data (books, guides, help) pick the
 * first candidate that fits, so a long book or question title drops the brand rather than being cut.
 */

export const TITLE_MIN = 30;
export const TITLE_MAX = 60;

const fits = (t: string) => t.length >= TITLE_MIN && t.length <= TITLE_MAX;

/** The first candidate of 30–60 characters; failing that, the longest one under 60; failing that, the shortest. */
export function fitTitle(candidates: string[]): string {
  const exact = candidates.find(fits);
  if (exact) return exact;
  const short = candidates.filter((t) => t.length <= TITLE_MAX).sort((a, b) => b.length - a.length)[0];
  return short ?? [...candidates].sort((a, b) => a.length - b.length)[0]!;
}

/** Titles of the fixed public pages. The home page title is Kevin's (2026-11-13). */
export const PAGE_TITLES = {
  home: "Readli: Bedtime Stories Read in Your Family's Voice",
  try: "Hear a story in your voice, free | Readli",
  grandparents: "Bedtime stories for grandkids, in your voice | Readli",
  pricing: "Pricing: Readli Family plan and free Readli Voice",
  gifts: "Give the gift of your voice at bedtime | Readli gifts",
  bedtimeStories: "Classic bedtime stories for kids | Readli",
  vs: "Readli alternatives and comparisons | Readli",
  howItWorks: "How Readli works: storybooks in family voices",
  familyVoices: "Family Voices: storybooks in a loved one's voice | Readli",
  readliKids: "Readli Kids: a safe listening space for children | Readli",
  guides: "Guides for storytelling families | Readli",
  books: "Classic Children's Books Read Aloud | Readli Library",
  parentsSafety: "Family privacy & safety | Readli",
  help: "Readli Help Center: answers for families",
  recordingTips: "Tips for a better voice recording | Readli Help Center",
  about: "About Us: the family story behind Readli",
  company: "Readli company details and contact",
  donations: "Donation Requests for School Raffles & Auctions | Readli",
  privacy: "Privacy Policy | Readli Family Storytelling",
  terms: "Terms of Service | Readli Family Storytelling",
  accessibility: "Accessibility Statement | Readli",
} as const;

export function bookTitle(b: { title: string; author: string }): string {
  const by = b.author && b.author !== "Traditional" ? ` by ${b.author}` : "";
  return fitTitle([
    `${b.title}${by} | Readli Library`,
    `${b.title}${by} | Readli`,
    `${b.title}: Read-Aloud Story | Readli`,
    `${b.title}${by}`,
    `${b.title} | Readli`,
    b.title,
  ]);
}

export function guideTitle(g: { title: string; seoTitle?: string }): string {
  const t = g.seoTitle ?? g.title;
  return fitTitle([`${t} | Readli`, t]);
}

export function helpCategoryTitle(c: { title: string }): string {
  return fitTitle([`${c.title} | Readli Help Center`, `${c.title} | Readli Help`, `${c.title} | Readli`, c.title]);
}

export function helpArticleTitle(a: { question: string; seoTitle?: string }): string {
  const q = a.seoTitle ?? a.question;
  return fitTitle([`${q} | Readli Help Center`, `${q} | Readli Help`, `${q} | Readli`, q]);
}

export function collectionTitle(c: { title: string }): string {
  return fitTitle([`${c.title} | Readli`, `${c.title} | Readli bedtime stories`, c.title]);
}

export function comparisonTitle(c: { name: string }): string {
  return fitTitle([`Readli or ${c.name}? How they compare | Readli`, `Readli or ${c.name}? How they compare`, `Readli vs ${c.name} | Readli`, `Readli vs ${c.name}`]);
}

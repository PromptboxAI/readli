import { GUIDES, guideHref } from "@/lib/guides/guides";
import { HELP_CATEGORIES } from "@/lib/help/articles";
import { articleHref, articlesIn, visibleArticles } from "@/lib/help/search";
import { bookPath } from "@/lib/library/paths";
import { publicLibrary } from "@/lib/library/public";

export interface PublicPage {
  path: string;
  title: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}

/** Every page that should be found in search, used by the sitemap and llms.txt. */
export function publicPages(): PublicPage[] {
  const pages: PublicPage[] = [
    { path: "/", title: "Readli home", priority: 1, changeFrequency: "weekly" },
    { path: "/try", title: "Hear a story in your voice, free", priority: 0.9, changeFrequency: "monthly" },
    { path: "/grandparents", title: "Read to your grandkids in your own voice", priority: 0.8, changeFrequency: "monthly" },
    { path: "/pricing", title: "Pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/how-it-works", title: "How Readli works", priority: 0.8, changeFrequency: "monthly" },
    { path: "/family-voices", title: "Family Voices", priority: 0.8, changeFrequency: "monthly" },
    { path: "/readli-kids", title: "Readli Kids", priority: 0.8, changeFrequency: "monthly" },
    { path: "/guides", title: "Stories & Guides", priority: 0.7, changeFrequency: "weekly" },
    { path: "/books", title: "The Readli Library", priority: 0.9, changeFrequency: "weekly" },
    { path: "/parents/safety", title: "Family privacy & safety", priority: 0.7, changeFrequency: "monthly" },
    { path: "/help", title: "Help Center", priority: 0.7, changeFrequency: "weekly" },
    { path: "/help/recording-tips", title: "Tips for a better voice recording", priority: 0.5, changeFrequency: "monthly" },
    { path: "/company", title: "Company", priority: 0.4, changeFrequency: "yearly" },
    { path: "/privacy", title: "Privacy Policy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", title: "Terms of Service", priority: 0.3, changeFrequency: "yearly" },
    { path: "/accessibility", title: "Accessibility Statement", priority: 0.3, changeFrequency: "yearly" },
  ];
  for (const g of GUIDES) pages.push({ path: guideHref(g), title: g.title, priority: 0.7, changeFrequency: "monthly" });
  for (const b of publicLibrary()) {
    pages.push({ path: bookPath(b.slug), title: `${b.title} by ${b.author}`, priority: b.comingSoon ? 0.5 : 0.8, changeFrequency: "monthly" });
  }
  for (const c of HELP_CATEGORIES) {
    if (articlesIn(c.slug).length > 0) pages.push({ path: `/help/${c.slug}`, title: c.title, priority: 0.5, changeFrequency: "monthly" });
  }
  for (const a of visibleArticles()) {
    if (a.status === "published") pages.push({ path: articleHref(a), title: a.question, priority: 0.5, changeFrequency: "monthly" });
  }
  return pages;
}

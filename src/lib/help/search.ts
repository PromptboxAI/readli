import { HELP_ARTICLES, HELP_CATEGORIES, type HelpArticle, type HelpCategory } from "./articles";

/**
 * Drafts describe features that aren't live yet. They show in local and preview builds (with a
 * Draft badge) so they can be reviewed, and stay hidden on the production site until launch.
 */
export function showDrafts(env: Record<string, string | undefined> = process.env): boolean {
  if (env.HELP_SHOW_DRAFTS === "1") return true;
  if (env.HELP_SHOW_DRAFTS === "0") return false;
  if (env.VERCEL_ENV) return env.VERCEL_ENV !== "production";
  return env.NODE_ENV !== "production";
}

export function visibleArticles(drafts = showDrafts()): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => drafts || a.status === "published");
}

export function getCategory(slug: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.slug === slug);
}

export function articlesIn(category: string, drafts = showDrafts()): HelpArticle[] {
  return visibleArticles(drafts).filter((a) => a.category === category);
}

export function getArticle(category: string, slug: string, drafts = showDrafts()): HelpArticle | undefined {
  return visibleArticles(drafts).find((a) => a.category === category && a.slug === slug);
}

export function relatedArticles(article: HelpArticle, drafts = showDrafts()): HelpArticle[] {
  const visible = visibleArticles(drafts);
  return (article.related ?? [])
    .map((slug) => visible.find((a) => a.slug === slug))
    .filter((a): a is HelpArticle => Boolean(a));
}

export function articleHref(a: HelpArticle): string {
  return `/help/${a.category}/${a.slug}`;
}

const STOP = new Set(["a", "an", "the", "i", "my", "me", "do", "does", "how", "can", "is", "to", "of", "and", "or", "what", "why", "in", "for", "it", "if", "on", "be", "are", "with"]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .split(/[^a-z0-9$.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** A word matches when one is a prefix of the other, so "record" finds "recording" and "mic" finds "microphone". */
function matches(word: string, term: string): boolean {
  return word === term || (term.length >= 3 && word.startsWith(term)) || (word.length >= 4 && term.startsWith(word));
}

/** Ranks visible articles for a search box query. Questions and keywords weigh more than answer text. */
export function searchHelp(query: string, drafts = showDrafts()): HelpArticle[] {
  const terms = [...new Set(tokens(query))];
  if (terms.length === 0) return [];
  const scored = visibleArticles(drafts).map((a, index) => {
    const q = tokens(a.question);
    const k = tokens((a.keywords ?? []).join(" "));
    const body = tokens(a.answer.join(" "));
    const title = getCategory(a.category)?.title ?? "";
    const c = tokens(title);
    let score = 0;
    let hit = 0;
    for (const term of terms) {
      const s =
        (q.some((w) => matches(w, term)) ? 5 : 0) +
        (k.some((w) => matches(w, term)) ? 4 : 0) +
        (c.some((w) => matches(w, term)) ? 1 : 0) +
        Math.min(body.filter((w) => matches(w, term)).length, 3);
      if (s > 0) hit++;
      score += s;
    }
    // Reward articles that match every word of the query.
    if (hit === terms.length) score += 3 * terms.length;
    return { a, score, index };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score || x.index - y.index)
    .map((s) => s.a);
}

/** Every article visible in this build, by slug: its page and question. Built into the app for in-app help links. */
export function helpLinkMap(drafts = showDrafts()): Record<string, { href: string; question: string }> {
  return Object.fromEntries(visibleArticles(drafts).map((a) => [a.slug, { href: articleHref(a), question: a.question }]));
}

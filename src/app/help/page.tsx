import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { ArticleList, CategoryIcon, SearchBox, StillNeedHelp } from "@/components/help/HelpParts";
import { HELP_CATEGORIES } from "@/lib/help/articles";
import { getCategory, searchHelp } from "@/lib/help/search";
import { publicPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Help Center | Readli",
  description: "Find answers about family stories, voices, subscriptions, privacy and more.",
  path: "/help",
});

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const query = ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim().slice(0, 100);
  const results = query ? searchHelp(query) : [];

  return (
    <>
      <SiteHeader />
      <main className="flex flex-col">
        <section className="bg-mint/45 px-4 py-14 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
            <span aria-hidden className="grid h-16 w-16 place-items-center rounded-2xl bg-surface shadow-sm">
              <svg viewBox="0 0 24 24" className="h-9 w-9 text-mint-deep" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zm0 0V19" />
              </svg>
            </span>
            <h1 className="font-display text-4xl font-semibold text-plum sm:text-5xl">Hi there! How can we help?</h1>
            <p className="text-lg">Find answers about family stories, voices, subscriptions, and more.</p>
            <SearchBox defaultValue={query} />
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-12 sm:px-6">
          {query && (
            <section aria-labelledby="results-heading" className="flex flex-col gap-4">
              <h2 id="results-heading" className="font-display text-2xl font-semibold" aria-live="polite">
                {results.length === 0
                  ? `No articles found for “${query}”`
                  : `${results.length} ${results.length === 1 ? "article" : "articles"} for “${query}”`}
              </h2>
              {results.length > 0 ? (
                <ArticleList articles={results} showCategory={(a) => getCategory(a.category)?.title ?? ""} />
              ) : (
                <p>Try different words, browse the topics below, or email us and we&apos;ll help.</p>
              )}
              <Link href="/help" className="self-start font-semibold underline underline-offset-4">
                Clear search
              </Link>
            </section>
          )}

          <section aria-labelledby="topics-heading" className="flex flex-col gap-5">
            <h2 id="topics-heading" className="font-display text-2xl font-semibold">
              Browse by topic
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {HELP_CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/help/${c.slug}`}
                    className="flex h-full items-center gap-4 rounded-3xl border-2 border-ink/10 bg-surface p-5 transition-transform hover:-translate-y-0.5 hover:border-ink/25"
                  >
                    <CategoryIcon icon={c.icon} tint={c.tint} />
                    <span className="flex flex-col gap-1">
                      <span className="font-display text-xl font-semibold">{c.title}</span>
                      <span className="text-muted">{c.blurb}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <StillNeedHelp />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

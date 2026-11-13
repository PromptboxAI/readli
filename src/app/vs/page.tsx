import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { readliFacts } from "@/lib/content/comparison-facts";
import { COMPARISONS_CHECKED, OTHER_OPTIONS, comparisonHref, comparisons, readliStrengths } from "@/lib/content/comparisons";
import { SITE_URL, absoluteUrl, jsonLd, publicPageMetadata } from "@/lib/seo/site";

const TITLE = "How Readli compares";
const DESCRIPTION =
  "How Readli compares with Lullify, StoryBee, Yoto and other ways families do bedtime stories: real family voices, classic books and parent approval.";

export const metadata: Metadata = publicPageMetadata({ title: "Readli alternatives and comparisons | Readli", description: DESCRIPTION, path: "/vs" });

// Quotes the library size and saved prices, so it renders per request.
export const dynamic = "force-dynamic";

const TINTS = ["bg-sunshine/60", "bg-mint", "bg-sky/60", "bg-lavender/70"];

export default async function CompareHub() {
  const facts = await readliFacts();
  const all = comparisons(facts);
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl("/vs"),
    url: absoluteUrl("/vs"),
    name: TITLE,
    description: DESCRIPTION,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    hasPart: all.map((c) => ({ "@type": "WebPage", name: `Readli or ${c.name}?`, url: absoluteUrl(comparisonHref(c.slug)) })),
  };
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-12 px-4 py-12 sm:px-6 sm:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
        <header className="flex flex-col gap-3">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-coral-deep">Compare</p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] sm:text-5xl">{TITLE}</h1>
          <p className="max-w-2xl text-lg">
            There are lots of ways to fill bedtime with stories. Readli is the one built around a loved one&apos;s real voice reading real classic
            books, shared safely between homes. Here&apos;s an honest look at how it compares.
          </p>
        </header>

        <section aria-labelledby="pages-heading" className="flex flex-col gap-4">
          <h2 id="pages-heading" className="font-display text-3xl font-semibold">
            Side-by-side comparisons
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3" data-testid="comparison-list">
            {all.map((c, i) => (
              <li key={c.slug}>
                <Link
                  href={comparisonHref(c.slug)}
                  className={`flex h-full flex-col gap-2 rounded-[var(--radius-panel)] p-6 transition-transform hover:-translate-y-0.5 ${TINTS[i % TINTS.length]}`}
                >
                  <h3 className="font-display text-xl font-semibold">Readli or {c.name}?</h3>
                  <p>{c.whatTheyAre}</p>
                  <span className="mt-auto pt-1 text-sm font-semibold underline underline-offset-4">See the comparison</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="others-heading" className="flex flex-col gap-4">
          <h2 id="others-heading" className="font-display text-3xl font-semibold">
            Other options families consider
          </h2>
          <ul className="flex flex-col gap-3" data-testid="other-options">
            {OTHER_OPTIONS.map((o) => (
              <li key={o.name} className="flex flex-col gap-1 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10">
                <h3 className="font-display text-lg font-semibold">{o.name}</h3>
                <p>{o.body}</p>
                {o.href && (
                  <a href={o.href} rel="nofollow noopener" target="_blank" className="text-sm underline underline-offset-4">
                    Source: {o.name} on the App Store
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="why-heading" className="flex flex-col gap-4">
          <h2 id="why-heading" className="font-display text-3xl font-semibold">
            What makes Readli different
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {readliStrengths(facts).map((s, i) => (
              <div key={s.title} className={`flex flex-col gap-2 rounded-[var(--radius-panel)] p-6 ${TINTS[i % TINTS.length]}`}>
                <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto`}>
            Hear a story in your voice, free
          </Link>
          <Link href="/pricing" className={`${buttonSecondary} w-full sm:w-auto`}>
            See pricing
          </Link>
        </div>

        <p className="border-t-2 border-ink/10 pt-6 text-sm text-muted">
          Details about other products come from their public websites and app store listings in {COMPARISONS_CHECKED}, and may have changed
          since. Product names are trademarks of their owners. Readli isn&apos;t affiliated with any of them.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

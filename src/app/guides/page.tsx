import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { GUIDES, GUIDE_AUTHOR, guideHref } from "@/lib/guides/guides";
import { SITE_URL, absoluteUrl, jsonLd, publicPageMetadata } from "@/lib/seo/site";

const DESCRIPTION = "Guides for parents and grandparents on recording your voice, reading to grandkids from far away, personalized audiobooks and keeping family voices safe.";

export const metadata: Metadata = publicPageMetadata({ title: "Stories & Guides | Readli", description: DESCRIPTION, path: "/guides" });

const TINTS = ["bg-sunshine/60", "bg-mint", "bg-sky/60", "bg-lavender/70"];

export default function GuidesPage() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl("/guides"),
    url: absoluteUrl("/guides"),
    name: "Stories & Guides",
    description: DESCRIPTION,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    hasPart: GUIDES.map((g) => ({ "@type": "Article", headline: g.title, url: absoluteUrl(guideHref(g)) })),
  };
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
        <header className="flex flex-col gap-3">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-coral-deep">Stories &amp; Guides</p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] sm:text-5xl">Guides for storytelling families</h1>
          <p className="max-w-2xl text-lg">
            Practical help for parents and grandparents who want their voices at bedtime, by {GUIDE_AUTHOR.name}, {GUIDE_AUTHOR.title}.
          </p>
        </header>
        <ul className="grid gap-4 sm:grid-cols-2" data-testid="guide-list">
          {GUIDES.map((g, i) => (
            <li key={g.slug}>
              <Link href={guideHref(g)} className={`flex h-full flex-col gap-2 rounded-[var(--radius-panel)] p-6 transition-transform hover:-translate-y-0.5 ${TINTS[i % TINTS.length]}`}>
                <h2 className="font-display text-xl font-semibold">{g.title}</h2>
                <p>{g.description}</p>
                <span className="mt-auto pt-1 text-sm font-semibold">{g.readMinutes} min read</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto sm:self-start`}>
          Hear a story in your voice, free
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}

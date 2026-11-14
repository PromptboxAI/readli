import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { COLLECTIONS, collectionBooks, collectionHref } from "@/lib/library/collections";
import { publicLibrary } from "@/lib/library/public";
import { SITE_URL, absoluteUrl, jsonLd, publicPageMetadata } from "@/lib/seo/site";

const TITLE = "Classic bedtime stories for kids";
const DESCRIPTION =
  "Classic bedtime stories by author, length and season: fairy tales, Beatrix Potter, Aesop's fables, poems and chapter books, read aloud in your family's own voices.";

export const metadata: Metadata = publicPageMetadata({ title: `${TITLE} | Readli`, description: DESCRIPTION, path: "/bedtime-stories" });

/** The collections index: every bedtime story collection, with a few covers from each. */
export default function BedtimeStoriesPage() {
  const library = publicLibrary();
  const ready = library.filter((b) => !b.comingSoon).length;
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl("/bedtime-stories"),
    url: absoluteUrl("/bedtime-stories"),
    name: TITLE,
    description: DESCRIPTION,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    hasPart: COLLECTIONS.map((c) => ({ "@type": "CollectionPage", name: c.title, url: absoluteUrl(collectionHref(c)) })),
  };
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
        <header className="flex max-w-3xl flex-col gap-3">
          <p className="font-display text-sm font-semibold tracking-[0.18em] text-coral-deep uppercase">Bedtime stories</p>
          <h1 className="font-display text-4xl leading-[1.05] font-semibold sm:text-5xl">{TITLE}</h1>
          <p className="text-lg">
            {ready} classic children&apos;s books, gathered the way families choose them at bedtime. Every one is the real public-domain story, and every
            one can be read aloud in the voice of someone your child loves.
          </p>
        </header>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="collection-list">
          {COLLECTIONS.map((c) => {
            const books = collectionBooks(c, library);
            const covers = [books.find((b) => b.slug === c.featured), ...books.filter((b) => b.slug !== c.featured)].filter((b) => b?.coverUrl).slice(0, 3);
            return (
              <li key={c.slug}>
                <Link href={collectionHref(c)} className={`flex h-full flex-col gap-3 rounded-[var(--radius-panel)] p-6 transition-transform hover:-translate-y-0.5 ${c.tint}`}>
                  <span className="flex gap-2" aria-hidden="true">
                    {covers.map((b) => (
                      <Image key={b!.slug} src={b!.coverUrl!} alt="" width={120} height={160} sizes="80px" className="aspect-[3/4] w-16 rounded-lg object-cover shadow-[3px_4px_0_rgba(40,53,72,0.16)] sm:w-20" />
                    ))}
                  </span>
                  <h2 className="font-display text-2xl font-semibold">{c.name}</h2>
                  <p>{c.description}</p>
                  <span className="mt-auto pt-1 text-sm font-semibold">
                    {books.length} {books.length === 1 ? "story" : "stories"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/books" className={`${buttonPrimary} w-full sm:w-auto`}>
            Browse the whole library
          </Link>
          <Link href="/try" className="inline-flex min-h-11 items-center justify-center font-semibold underline underline-offset-4">
            Hear a story in your voice, free
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

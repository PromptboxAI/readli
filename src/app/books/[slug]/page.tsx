import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { authConfigured } from "@/lib/auth/supabase";
import { bookCredits, monthsOfCredits } from "@/lib/content/credits-explained";
import { planConfig } from "@/lib/family/plan";
import { bookOpening } from "@/lib/library/opening";
import { type PublicBook, publicBook, publicLibrary } from "@/lib/library/public";
import { absoluteUrl, jsonLd, publicPageMetadata } from "@/lib/seo/site";

export function generateStaticParams() {
  return publicLibrary().map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const book = publicBook((await params).slug);
  if (!book) return {};
  return publicPageMetadata({
    title: `${book.title} by ${book.author} | Readli Library`,
    description: bookDescription(book),
    path: `/books/${book.slug}`,
    type: "book",
    images: book.coverUrl ? [{ url: book.coverUrl, alt: `${book.title} cover`, width: 900, height: 1200 }] : undefined,
  });
}

/** "About 6 credits in one voice": what preparing the whole book costs, in the plan's terms. */
function creditLine(book: PublicBook): string | null {
  if (book.characters === null) return null;
  const plan = planConfig();
  const credits = bookCredits(book.characters, plan.charactersPerCredit);
  const unit = credits === 1 ? "credit" : "credits";
  if (credits <= plan.monthlyCredits) {
    return `About ${credits} Readli ${unit} to prepare in one voice, out of the ${plan.monthlyCredits} that come with Readli Family each month. Replays are free.`;
  }
  return `About ${credits} Readli credits for the whole book in one voice, or about ${monthsOfCredits(credits, plan.monthlyCredits)} months of Readli Family credits. Prepare it a chapter at a time, and replays are free.`;
}

function bookDescription(book: PublicBook): string {
  const published = book.firstPublished ? `, first published in ${book.firstPublished}` : "";
  if (book.comingSoon) return `${book.title} by ${book.author}${published}. Coming soon to the Readli library, read aloud in your family's own voices.`;
  const length = book.minutes < 1 ? "Under a minute" : `About ${Math.round(book.minutes)} minutes`;
  const chapters = book.chapters.length > 1 ? ` in ${book.chapters.length} chapters` : "";
  return `${book.title} by ${book.author}${published}. ${length} read aloud${chapters}. Hear it in the voices of the people your kids love with Readli.`;
}

/**
 * One book, public. Preparing narration happens in the family library, which checks the grown-up's
 * account, their family's permissions and their Readli credits before anything is generated.
 */
export default async function PublicBookPage({ params }: { params: Promise<{ slug: string }> }) {
  const book = publicBook((await params).slug);
  if (!book) notFound();
  const prepare = `/family/books/${book.slug}`;
  const opening = bookOpening(book.slug);
  const bookLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    description: bookDescription(book),
    author: { "@type": "Person", name: book.author },
    ...(book.firstPublished ? { datePublished: String(book.firstPublished) } : {}),
    ...(book.coverUrl ? { image: absoluteUrl(book.coverUrl) } : {}),
    url: absoluteUrl(`/books/${book.slug}`),
    inLanguage: "en",
    audience: { "@type": "PeopleAudience", audienceType: "Children" },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "The Readli Library", item: absoluteUrl("/books") },
      { "@type": "ListItem", position: 2, name: book.title },
    ],
  };
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(bookLd)} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd)} />
        {book.coverUrl ? (
          <Image src={book.coverUrl} alt="" width={450} height={600} priority className="aspect-[3/4] w-full max-w-sm rounded-3xl object-cover" />
        ) : (
          <div className={`flex aspect-[3/4] w-full max-w-sm items-center justify-center rounded-3xl p-6 text-center font-display text-3xl font-semibold ${book.tint}`}>
            {book.title}
          </div>
        )}
        <div className="flex flex-col gap-4">
          <Link href="/books" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
            ← The Readli Library
          </Link>
          <h1 className="font-display text-4xl font-semibold">{book.title}</h1>
          <p className="text-lg text-muted">
            {book.author}
            {book.firstPublished ? `, ${book.firstPublished}` : ""}
          </p>
          <p>
            {book.comingSoon ? `About ${Math.round(book.minutes)} minutes when read aloud.` : book.minutes < 1 ? "Under a minute to read aloud." : `About ${Math.round(book.minutes)} minutes to read aloud.`}
          </p>
          {!book.comingSoon && creditLine(book) && (
            <p className="text-muted" data-testid="public-credits">
              {creditLine(book)}{" "}
              <Link href="/pricing#credits" className="font-semibold text-ink underline underline-offset-4">
                How credits work
              </Link>
            </p>
          )}
          {book.comingSoon ? (
            <p className="rounded-2xl bg-sunshine/50 p-3 font-semibold" data-testid="public-coming-soon">
              Coming soon to the library.
            </p>
          ) : (
            <>
              {opening.length > 0 && (
                <section aria-labelledby="opening-h" className="flex flex-col gap-2.5 rounded-3xl border-[3px] border-sunshine bg-surface p-5 sm:px-6" data-testid="public-opening">
                  <h2 id="opening-h" className="font-display text-2xl font-semibold">
                    How it starts
                  </h2>
                  {opening.map((p, i) => (
                    <p key={i} className="text-lg leading-relaxed whitespace-pre-line">
                      {p}
                    </p>
                  ))}
                  <p className="text-sm text-muted">Word for word from the edition your family will hear.</p>
                </section>
              )}
              {book.chapters.length > 1 && (
                <section aria-labelledby="chapters-h" className="flex flex-col gap-2">
                  <h2 id="chapters-h" className="font-display text-2xl font-semibold">
                    Chapters
                  </h2>
                  <ol className="list-decimal pl-6">
                    {book.chapters.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ol>
                </section>
              )}
              <div className="flex flex-wrap gap-3">
                <Link href={authConfigured() ? `/login?next=${encodeURIComponent(prepare)}` : prepare} className={buttonPrimary} data-testid="public-prepare">
                  Hear it in your family&apos;s voices
                </Link>
                <Link href="/try" className={buttonSecondary}>
                  Try your voice free
                </Link>
              </div>
              <p className="text-sm text-muted">Preparing a story needs a Readli Family account, a family member&apos;s shared voice and enough Readli credits. You&apos;ll see the exact cost before anything is made.</p>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { HelpText } from "@/components/help/HelpParts";
import { SamplePlayer } from "@/components/home/SamplePlayer";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { CollectionShelf } from "@/components/library/CollectionShelf";
import { COLLECTIONS, collectionBooks, collectionHref, getCollection } from "@/lib/library/collections";
import { bookPath } from "@/lib/library/paths";
import { publicLibrary } from "@/lib/library/public";
import { BOOK_SAMPLE_NARRATOR, bookSampleSrc } from "@/lib/library/samples";
import { SITE_URL, absoluteUrl, jsonLd, publicPageMetadata } from "@/lib/seo/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ slug: c.slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const c = getCollection((await params).slug);
  if (!c) return {};
  return publicPageMetadata({ title: `${c.title} | Readli`, description: c.description, path: collectionHref(c) });
}

/**
 * One bedtime story collection (SleepyTale review, 2026-11): original writing about the stories, a
 * sample of the featured book in a real Readli voice, every book in the collection and a short FAQ.
 */
export default async function CollectionPage({ params }: { params: Params }) {
  const c = getCollection((await params).slug);
  if (!c) notFound();
  const books = collectionBooks(c, publicLibrary());
  const featured = books.find((b) => b.slug === c.featured) ?? books[0];
  const sample = featured ? bookSampleSrc(featured.slug) : null;
  const others = COLLECTIONS.filter((o) => o.slug !== c.slug);
  const url = absoluteUrl(collectionHref(c));
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": url,
        url,
        name: c.title,
        description: c.description,
        inLanguage: "en",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: books.length,
          itemListElement: books.map((b, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(bookPath(b.slug)), name: b.title })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Bedtime stories", item: absoluteUrl("/bedtime-stories") },
          { "@type": "ListItem", position: 2, name: c.name },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: c.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
        <Link href="/bedtime-stories" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Bedtime stories
        </Link>
        <header className="grid items-start gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-4xl leading-[1.05] font-semibold sm:text-5xl">{c.title}</h1>
            {c.intro.map((p) => (
              <p key={p} className="text-lg leading-relaxed">
                <HelpText text={p} />
              </p>
            ))}
          </div>
          {featured && sample && (
            <div className={`flex flex-col gap-3 rounded-[var(--radius-panel)] p-5 sm:p-6 ${c.tint}`} data-testid="collection-sample">
              <p className="text-sm font-extrabold tracking-[0.1em] uppercase">Hear how it sounds</p>
              <p>
                The opening of{" "}
                <Link href={bookPath(featured.slug)} className="font-semibold underline underline-offset-4">
                  {featured.title}
                </Link>
                , read in a real family voice made from one minute of recording.
              </p>
              <SamplePlayer src={sample} title={featured.title} narrator={BOOK_SAMPLE_NARRATOR} length={null} />
            </div>
          )}
        </header>

        <section aria-labelledby="books-heading" className="flex flex-col gap-5">
          <h2 id="books-heading" className="font-display text-3xl font-semibold">
            {books.length} {books.length === 1 ? "story" : "stories"} in this collection
          </h2>
          <CollectionShelf books={books} />
        </section>

        <section aria-labelledby="more-heading" className="flex max-w-3xl flex-col gap-3">
          <h2 id="more-heading" className="font-display text-3xl font-semibold">
            {c.more.heading}
          </h2>
          {c.more.paragraphs.map((p) => (
            <p key={p} className="text-lg leading-relaxed">
              <HelpText text={p} />
            </p>
          ))}
        </section>

        <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-sunshine/45 p-6 sm:p-8">
          <p className="font-display text-2xl font-semibold">Hear these stories in your family&apos;s voices</p>
          <p className="max-w-2xl">
            A parent, grandparent or loved one records about a minute, and Readli reads every story here in that voice. Try it with your own voice first,
            free and with no account.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/try" className={`${buttonPrimary} w-full sm:w-auto`}>
              Try your voice free
            </Link>
            <Link href="/how-it-works" className={`${buttonSecondary} w-full sm:w-auto`}>
              How Readli works
            </Link>
          </div>
        </div>

        <section aria-labelledby="faq-heading" className="flex max-w-3xl flex-col gap-3">
          <h2 id="faq-heading" className="font-display text-3xl font-semibold">
            Questions parents ask
          </h2>
          {c.faqs.map((f) => (
            <details key={f.q} className="rounded-2xl bg-surface px-5 py-4 ring-2 ring-ink/10">
              <summary className="cursor-pointer font-display text-lg font-semibold">{f.q}</summary>
              <p className="mt-2 text-lg leading-relaxed">{f.a}</p>
            </details>
          ))}
        </section>

        <nav aria-labelledby="more-collections" className="flex flex-col gap-3">
          <h2 id="more-collections" className="font-display text-2xl font-semibold">
            More bedtime story collections
          </h2>
          <ul className="flex flex-wrap gap-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={collectionHref(o)} className={`inline-flex min-h-11 items-center rounded-full px-4 font-semibold hover:underline ${o.tint}`}>
                  {o.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/books" className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 font-semibold ring-2 ring-ink/10 hover:underline">
                The whole library
              </Link>
            </li>
          </ul>
        </nav>
      </main>
      <SiteFooter />
    </>
  );
}

import type { Metadata } from "next";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import Link from "next/link";
import { LibrarySearch } from "@/components/library/LibrarySearch";
import { COLLECTIONS, collectionHref } from "@/lib/library/collections";
import { publicLibrary } from "@/lib/library/public";
import { publicPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicPageMetadata({
  title: "The Readli Library",
  description: "Browse every story in the Readli library. Hear them read in your family's own voices.",
  path: "/books",
});

/** The public library: anyone can browse and search, no account needed. */
export default function BooksPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">The Readli Library</h1>
          <p className="max-w-2xl text-lg">
            Classic stories, ready to be read aloud in the voices your children love. Browse freely. A Readli Family account prepares them in your family&apos;s voices.
          </p>
        </div>
        <nav aria-labelledby="collections-heading" className="flex flex-col gap-2" data-testid="library-collections">
          <h2 id="collections-heading" className="font-display text-xl font-semibold">
            Browse by collection
          </h2>
          <ul className="flex flex-wrap gap-2">
            {COLLECTIONS.map((c) => (
              <li key={c.slug}>
                <Link href={collectionHref(c)} className={`inline-flex min-h-11 items-center rounded-full px-4 font-semibold hover:underline ${c.tint}`}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <LibrarySearch books={publicLibrary()} />
      </main>
      <SiteFooter />
    </>
  );
}

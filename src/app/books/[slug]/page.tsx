import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { authConfigured } from "@/lib/auth/supabase";
import { publicBook, publicLibrary } from "@/lib/library/public";

export function generateStaticParams() {
  return publicLibrary().map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const book = publicBook((await params).slug);
  return book ? { title: `${book.title} | Readli Library`, description: `${book.title} by ${book.author}, in the Readli library.` } : {};
}

/**
 * One book, public. Preparing narration happens in the family library, which checks the grown-up's
 * account, their family's permissions and their Readli credits before anything is generated.
 */
export default async function PublicBookPage({ params }: { params: Promise<{ slug: string }> }) {
  const book = publicBook((await params).slug);
  if (!book) notFound();
  const prepare = `/family/books/${book.slug}`;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
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
          {book.comingSoon ? (
            <p className="rounded-2xl bg-sunshine/50 p-3 font-semibold" data-testid="public-coming-soon">
              Coming soon to the library.
            </p>
          ) : (
            <>
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

import Image from "next/image";
import { coverSrc, DEMO_BOOKS, gutenbergUrl, isPassagePlayable, type DemoBook } from "@/lib/content/demo-books";

function Cover({ book }: { book: DemoBook }) {
  // Original Readli artwork; the title is printed on the cover, so the heading below carries the name.
  return (
    <Image
      src={coverSrc(book)}
      alt=""
      width={600}
      height={800}
      sizes="(min-width: 1024px) 300px, 45vw"
      className="aspect-[3/4] w-full rounded-xl object-cover shadow-[4px_6px_0_rgba(40,53,72,0.18)] transition-transform group-hover:-translate-y-1 group-hover:rotate-[-1deg]"
    />
  );
}

export function DemoBookCard({ book }: { book: DemoBook }) {
  const playable = isPassagePlayable(book);
  const headingId = `book-${book.slug}`;
  return (
    <article aria-labelledby={headingId} className="group flex w-full flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-3 sm:p-4">
      <Cover book={book} />
      <div className="flex flex-1 flex-col gap-1">
        <h3 id={headingId} className="font-display text-base font-semibold leading-snug sm:text-lg">
          {book.title}
        </h3>
        <p className="text-sm text-muted">
          {book.author}, {book.firstPublished}
        </p>
        <p className="text-sm text-muted">About {book.passageTargetSeconds} second passage</p>
      </div>
      <button
        type="button"
        disabled={!playable}
        aria-describedby={`${headingId}-status`}
        className="min-h-12 rounded-full border-[3px] border-ink bg-sunshine px-4 font-display font-semibold disabled:cursor-not-allowed disabled:bg-ivory disabled:text-muted"
      >
        Hear this passage
      </button>
      <p id={`${headingId}-status`} className="text-xs text-muted">
        {playable ? "Plays in your recorded voice." : "Passage pending rights review."}{" "}
        {gutenbergUrl(book) && (
          <a href={gutenbergUrl(book) ?? undefined} className="underline" target="_blank" rel="noreferrer">
            Source
          </a>
        )}
      </p>
    </article>
  );
}

export function DemoBookShelf({ heading = "Pick a story to hear in your voice" }: { heading?: string }) {
  return (
    <section aria-labelledby="demo-books-heading" data-testid="demo-books" className="flex flex-col gap-4">
      <h2 id="demo-books-heading" className="font-display text-2xl font-semibold sm:text-3xl">
        {heading}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {DEMO_BOOKS.map((book) => (
          <li key={book.slug} className="flex">
            <DemoBookCard book={book} />
          </li>
        ))}
      </ul>
    </section>
  );
}

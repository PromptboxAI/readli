import { DEMO_BOOKS, gutenbergUrl, isPassagePlayable, type DemoBook } from "@/lib/content/demo-books";

function CoverTile({ book }: { book: DemoBook }) {
  // Placeholder shapes only: no edition artwork until rights review clears it.
  return (
    <div
      className="relative flex aspect-[4/5] items-end overflow-hidden rounded-2xl border-[3px] border-ink p-3"
      style={{ background: book.tile.background }}
      aria-hidden="true"
    >
      <div className="absolute -right-6 -top-6 size-24 rounded-full opacity-80" style={{ background: book.tile.accent }} />
      <div className="absolute bottom-10 left-4 size-10 rotate-12 rounded-xl bg-surface/80" />
      <span className="relative font-display text-sm font-semibold leading-tight text-ink sm:text-base">{book.title}</span>
    </div>
  );
}

export function DemoBookCard({ book }: { book: DemoBook }) {
  const playable = isPassagePlayable(book);
  const headingId = `book-${book.slug}`;
  return (
    <article aria-labelledby={headingId} className="flex w-full flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-3 sm:p-4">
      <CoverTile book={book} />
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
        <a href={gutenbergUrl(book)} className="underline" target="_blank" rel="noreferrer">
          Source
        </a>
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

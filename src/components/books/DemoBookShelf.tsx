import Image from "next/image";
import Link from "next/link";
import { coverSrc, DEMO_BOOKS, isPassagePlayable, type DemoBook } from "@/lib/content/demo-books";

function Cover({ book }: { book: DemoBook }) {
  // Original Readli artwork; the title is printed on the cover, so the heading below carries the name.
  return (
    <Image
      src={coverSrc(book)}
      alt=""
      width={600}
      height={800}
      sizes="(min-width: 1024px) 300px, 45vw"
      className="aspect-[3/4] w-full rounded-r-xl rounded-l-sm object-cover shadow-[4px_0_0_rgba(40,53,72,0.18)] transition-transform group-hover:-translate-y-2 group-hover:rotate-[-1.5deg] motion-reduce:transform-none"
    />
  );
}

export interface HearOptions {
  /** Called when the guest asks to hear a book. Without it, the button links to the recorder. */
  onHear?: (book: DemoBook) => void;
  /** Slug currently being prepared or played. */
  activeSlug?: string | null;
  /** Shown under every book and disables the buttons, e.g. while previews are off or busy. */
  disabledReason?: string | null;
  /** Books already read in this voice: they replay for free, even after the previews run out. */
  explored?: ReadonlySet<string>;
  /** Disables every button, explored books too (one story at a time). */
  busy?: boolean;
}

const hearButton =
  "inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full border-[3px] border-ink bg-sunshine px-2 text-sm font-display font-semibold sm:px-4 sm:text-base";

export function DemoBookCard({ book, onHear, activeSlug, disabledReason, explored, busy }: { book: DemoBook } & HearOptions) {
  const playable = isPassagePlayable(book);
  const headingId = `book-${book.slug}`;
  const active = activeSlug === book.slug;
  const heard = explored?.has(book.slug) ?? false;
  const status = !playable
    ? "Preview coming soon."
    : !onHear
      ? null // Homepage: the button already leads to recording, so no hint (Kevin, 2026-10-11).
      : active
        ? "Playing in your voice."
        : heard && !busy
          ? "Explored. Replays are free."
          : (disabledReason ?? "Plays in your recorded voice.");
  return (
    <article aria-labelledby={headingId} className="group flex w-full flex-col gap-3">
      <div className="px-1 sm:px-3">
        <Cover book={book} />
      </div>
      {/* Shelf plank; the negative margin spans the grid gap so each row reads as one shelf. */}
      <div aria-hidden="true" className="-mx-2 -mt-3 h-3.5 rounded-sm bg-wood shadow-[0_6px_0_var(--color-wood-deep)] sm:-mx-3" />
      <div className="mt-2 flex flex-1 flex-col gap-1">
        <h3 id={headingId} className="font-display text-base font-semibold leading-snug sm:text-lg">
          {book.title}
        </h3>
        <p className="text-sm text-muted">
          {book.author}, {book.firstPublished}
        </p>
      </div>
      {onHear || !playable ? (
        <button
          type="button"
          disabled={!playable || !onHear || active || Boolean(busy) || (Boolean(disabledReason) && !heard)}
          aria-describedby={`${headingId}-status`}
          onClick={() => onHear?.(book)}
          className={`${hearButton} disabled:cursor-not-allowed disabled:bg-ivory disabled:text-muted ${active ? "!bg-mint !text-ink" : ""}`}
        >
          {active ? "Now playing" : heard ? "Play again" : "Hear this passage"}
        </button>
      ) : (
        <Link href="/try" className={hearButton}>
          Hear this passage
        </Link>
      )}
      {status && (
        <p id={`${headingId}-status`} className="text-xs text-muted">
          {status}
        </p>
      )}
    </article>
  );
}

export function DemoBookShelf({ heading = "Pick a story to hear in your voice", ...hear }: { heading?: string } & HearOptions) {
  return (
    <section aria-labelledby="demo-books-heading" data-testid="demo-books" className="flex flex-col gap-4">
      <h2 id="demo-books-heading" className="font-display text-2xl font-semibold sm:text-3xl">
        {heading}
      </h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-10 rounded-[var(--radius-panel)] bg-bookcase px-5 pb-6 pt-8 sm:gap-x-6 sm:px-8 lg:grid-cols-3">
        {DEMO_BOOKS.map((book) => (
          <li key={book.slug} className="flex">
            <DemoBookCard book={book} {...hear} />
          </li>
        ))}
      </ul>
    </section>
  );
}

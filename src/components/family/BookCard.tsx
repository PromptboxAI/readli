import Image from "next/image";
import Link from "next/link";
import type { LibraryCard } from "@/lib/library/discovery";

const BADGE: Record<string, string> = {
  ready: "bg-mint",
  partial: "bg-sunshine",
  preparing: "bg-sky/60",
  available: "bg-lavender/60",
  needs_credits: "bg-coral/30",
};

/** A book in the family library, with each narrator's status for it. */
export function BookCard({ book }: { book: LibraryCard }) {
  return (
    <Link
      href={`/family/books/${book.slug}`}
      className="flex w-44 shrink-0 flex-col gap-2 rounded-3xl bg-surface p-3 ring-2 ring-ink/10 hover:ring-ink sm:w-52"
      data-testid={`book-${book.slug}`}
    >
      {book.coverUrl ? (
        <Image src={book.coverUrl} alt="" width={180} height={240} className="aspect-[3/4] w-full rounded-2xl object-cover" />
      ) : (
        <span className={`flex aspect-[3/4] w-full items-center justify-center rounded-2xl p-3 text-center font-display text-xl font-semibold ${book.tint}`}>{book.title}</span>
      )}
      <span className="font-display text-lg font-semibold leading-tight">{book.title}</span>
      <span className="text-sm text-muted">
        {book.minutes < 1 ? "Under a minute" : `About ${book.minutes} min`}
        {book.chapters > 1 ? ` · ${book.chapters} chapters` : ""}
      </span>
      <ul className="flex flex-wrap gap-1 text-xs font-bold" aria-label="Storytellers">
        {book.narrators.map((n) => (
          <li key={n.voiceId} className={`rounded-full px-2 py-0.5 ${BADGE[n.availability] ?? "bg-ink/10"}`}>
            {n.name}: {n.label}
          </li>
        ))}
      </ul>
    </Link>
  );
}

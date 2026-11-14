import Image from "next/image";
import Link from "next/link";
import { coverAlt } from "@/lib/library/cover-alt";
import { bookPath } from "@/lib/library/paths";
import type { PublicBook } from "@/lib/library/public";

function readingTime(b: PublicBook): string {
  if (b.minutes < 1) return "Under a minute";
  const m = Math.round(b.minutes);
  if (m < 60) return `About ${m} min`;
  const h = Math.round(b.minutes / 30) / 2;
  return `About ${h} ${h === 1 ? "hour" : "hours"}`;
}

/** A collection's books as cover cards, each linking to its public book page. */
export function CollectionShelf({ books }: { books: PublicBook[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4" data-testid="collection-books">
      {books.map((b) => (
        <li key={b.slug}>
          <Link href={bookPath(b.slug)} className="group flex flex-col gap-2">
            {b.coverUrl ? (
              <Image
                src={b.coverUrl}
                alt={coverAlt(b)}
                width={450}
                height={600}
                sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw"
                className="aspect-[3/4] w-full rounded-xl object-cover shadow-[4px_6px_0_rgba(40,53,72,0.18)] transition-transform group-hover:-translate-y-1"
              />
            ) : (
              <span className={`flex aspect-[3/4] w-full items-center justify-center rounded-xl p-3 text-center font-display text-lg font-semibold ${b.tint}`}>{b.title}</span>
            )}
            <span className="font-display text-lg leading-snug font-semibold group-hover:underline">{b.title}</span>
            <span className="text-sm text-muted">
              {b.author} · {b.comingSoon ? "Coming soon" : readingTime(b)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

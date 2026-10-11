"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { PublicBook } from "@/lib/library/public";
import { matchesSearch } from "@/lib/library/search";

function length(b: PublicBook): string {
  if (b.minutes < 1) return "Under a minute";
  return `About ${Math.round(b.minutes)} min`;
}

/** Searchable grid of every book in the library. */
export function LibrarySearch({ books }: { books: PublicBook[] }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => books.filter((b) => matchesSearch(b, query)), [books, query]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-q`} className="font-semibold">
          Search by title or author
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Peter Rabbit, Andersen, bears…"
          className="min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink"
          data-testid="library-search"
        />
        <p className="text-sm text-muted" aria-live="polite">
          {shown.length === books.length ? `${books.length} stories` : `${shown.length} of ${books.length} stories`}
        </p>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4">No stories match that yet. Try another title or author.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((b) => (
            <li key={b.slug}>
              <Link
                href={`/books/${b.slug}`}
                className="flex h-full flex-col gap-2 rounded-3xl bg-surface p-3 ring-2 ring-ink/10 hover:ring-ink"
                data-testid={`public-book-${b.slug}`}
              >
                {b.coverUrl ? (
                  <Image src={b.coverUrl} alt="" width={240} height={320} className="aspect-[3/4] w-full rounded-2xl object-cover" />
                ) : (
                  <span className={`flex aspect-[3/4] w-full items-center justify-center rounded-2xl p-3 text-center font-display text-xl font-semibold ${b.tint}`}>
                    {b.title}
                  </span>
                )}
                <span className="font-display text-lg font-semibold leading-tight">{b.title}</span>
                <span className="text-sm text-muted">{b.author}</span>
                <span className="mt-auto text-sm">
                  {length(b)}
                  {b.chapters.length > 1 ? ` · ${b.chapters.length} chapters` : ""}
                </span>
                {b.comingSoon && <span className="self-start rounded-full bg-ink/10 px-2 py-0.5 text-xs font-bold">Coming soon</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

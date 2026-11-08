"use client";

import Link from "next/link";
import { useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { FavoriteButton } from "./FavoriteButton";
import { KidsCover } from "./KidsCover";
import { SavedBadge } from "./KidsOffline";

export interface KidsShelfItem {
  slug: string;
  title: string;
  coverUrl: string | null;
  tint: string;
  voices: string[];
  favorite: boolean;
}

/**
 * The ready books on a child's bookshelf: hearted ones in "My favorites", the rest in "Ready to listen".
 * Tapping a heart moves the book between the two rows straight away and saves it in the background.
 */
export function KidsShelfGrid({ childId, books, showEmpty }: { childId: string; books: KidsShelfItem[]; showEmpty: boolean }) {
  const [favorites, setFavorites] = useState(() => new Set(books.filter((b) => b.favorite).map((b) => b.slug)));
  const set = (slug: string, on: boolean) =>
    setFavorites((prev) => {
      const next = new Set(prev);
      if (on) next.add(slug);
      else next.delete(slug);
      return next;
    });
  const toggle = async (slug: string) => {
    const on = !favorites.has(slug);
    set(slug, on);
    const res = await fetch(`/api/kids/${childId}/favorites`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookSlug: slug, on }),
    }).catch(() => null);
    if (!res?.ok) set(slug, !on);
  };
  const faves = books.filter((b) => favorites.has(b.slug));
  const rest = books.filter((b) => !favorites.has(b.slug));
  const grid = (list: KidsShelfItem[]) => (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
      {list.map((b) => (
        <li key={b.slug} className="relative">
          <Link href={`/kids/listen/${b.slug}`} className="group flex flex-col gap-2">
            <span className="relative block">
              <KidsCover url={b.coverUrl} tint={b.tint} title={b.title} />
              <SavedBadge childId={childId} bookSlug={b.slug} />
            </span>
            <span className="font-display text-lg leading-tight font-semibold">{b.title}</span>
            <span className="text-sm text-muted">
              <span className="sr-only">Ready to listen, </span>with {b.voices.join(" or ")}
            </span>
          </Link>
          <span className="absolute top-2 right-2 rounded-full bg-surface/90">
            <FavoriteButton title={b.title} on={favorites.has(b.slug)} onToggle={() => void toggle(b.slug)} />
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      {faves.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="my-favorites-h" data-testid="kids-favorites">
          <h2 id="my-favorites-h" className="flex items-center gap-2 font-display text-2xl font-semibold">
            <span aria-hidden="true" className="text-coral-deep">
              ♥
            </span>
            My favorites
          </h2>
          {grid(faves)}
        </section>
      )}
      {/* The story in Continue listening isn't repeated here; with nothing else ready, the section steps aside. */}
      {(rest.length > 0 || (books.length === 0 && showEmpty)) && (
        <section className="flex flex-col gap-4" aria-labelledby="my-stories-h" data-testid="kids-ready">
          <h2 id="my-stories-h" className="font-display text-2xl font-semibold">
            {faves.length > 0 ? "More stories" : "Ready to listen"}
          </h2>
          {books.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[28px] bg-surface p-8 text-center ring-2 ring-ink/10" data-testid="kids-empty">
              <ReadiMascot size={120} decorative />
              <p className="font-display text-2xl font-semibold">No stories ready yet</p>
              <p className="max-w-md text-lg">Ask a grown-up to get a story ready for you. It will be right here when it&apos;s done.</p>
            </div>
          )}
          {grid(rest)}
        </section>
      )}
    </>
  );
}

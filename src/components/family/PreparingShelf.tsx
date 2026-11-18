"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { PreparingBook } from "@/lib/family/home";

const POLL_MS = 8000;

function names(list: string[]): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

/**
 * Books being prepared, at the front of the Family bookshelf, newest first, so a grown-up who closed a
 * book's page while it prepared can find it again (Kevin, 2026-11-03). While any is preparing, Home
 * checks in every few seconds: that keeps the preparation going and moves a finished book onto the shelf.
 */
export function PreparingShelf({ books }: { books: PreparingBook[] }) {
  const router = useRouter();
  const first = books[0]?.slug ?? null;
  useEffect(() => {
    if (!first) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetch(`/api/family/books/${first}/narration`, { cache: "no-store" })
        .catch(() => undefined)
        .finally(() => router.refresh());
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [first, router]);

  return (
    <ul className="grid gap-3 md:grid-cols-2" data-testid="shelf-preparing">
      {books.map((b) => (
        <li key={b.slug} className="relative flex gap-3 rounded-3xl bg-sky/20 p-3 ring-2 ring-sky/60 focus-within:ring-ink hover:ring-ink/30" data-testid={`shelf-preparing-${b.slug}`}>
          <span className="block w-16 shrink-0 self-start overflow-hidden rounded-xl bg-bookcase opacity-80 shadow-[0_3px_0_rgba(40,53,72,0.12)]">
            {b.coverUrl ? (
              <Image src={b.coverUrl} alt="" width={64} height={85} className="aspect-[3/4] w-full object-cover" />
            ) : (
              <span className={`flex aspect-[3/4] w-full items-center justify-center p-1 text-center font-display text-[0.6rem] leading-tight font-semibold ${b.tint}`}>{b.title}</span>
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded bg-sky/40 px-2 py-0.5 text-xs font-bold tracking-wide uppercase">
              <span aria-hidden="true" className="size-3 animate-spin rounded-full border-2 border-ink/25 border-t-ink" />
              Preparing
            </span>
            <Link href={b.href} className="font-display text-lg leading-tight font-semibold outline-none after:absolute after:inset-0 after:rounded-3xl">
              {b.title}
            </Link>
            <p className="text-sm text-muted">
              Read by {names(b.narrators.map((n) => n.name))} · {b.percent}% ready
            </p>
            <span className="block h-1.5 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={b.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${b.title} preparing`}>
              <span className="block h-full rounded-full bg-mint-deep transition-[width]" style={{ width: `${Math.max(4, b.percent)}%` }} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

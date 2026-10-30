"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export interface NewBook {
  slug: string;
  title: string;
  author: string;
  coverUrl: string | null;
}

/** Bedtime Thursdays in the app: the week's two stories, until this grown-up closes it (kept on the server). */
export function NewThisWeek({ weekOf, books }: { weekOf: string; books: NewBook[] }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const dismiss = () => {
    setOpen(false);
    void fetch("/api/family/new-books", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weekOf }),
      keepalive: true,
    }).catch(() => undefined);
  };
  return (
    <section className="flex items-start gap-3 rounded-2xl bg-sunshine/40 px-4 py-3" aria-label="New this week" data-testid="new-this-week">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-semibold">New this week for bedtime</p>
        <ul className="flex flex-wrap gap-3">
          {books.map((b) => (
            <li key={b.slug}>
              <Link href={`/family/books/${b.slug}`} className="flex items-center gap-2 font-semibold underline-offset-4 hover:underline">
                {b.coverUrl && <Image src={b.coverUrl} alt="" width={36} height={48} className="aspect-[3/4] w-9 rounded-md object-cover" />}
                <span>
                  {b.title} <span className="font-normal text-muted">by {b.author}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="-my-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-xl hover:bg-sunshine/60">
        <span aria-hidden="true">×</span>
      </button>
    </section>
  );
}

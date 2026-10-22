"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { HomeRequest } from "@/lib/family/home";

/** Books the kids asked for in Readli Kids. Prepare it opens the book page; nothing is prepared from here. */
export function StoryRequests({ requests }: { requests: HomeRequest[] }) {
  const [gone, setGone] = useState<string[]>([]);
  const open = requests.filter((r) => !gone.includes(r.id));
  if (!open.length) return null;
  const dismiss = (id: string) => {
    setGone((g) => [...g, id]);
    void fetch(`/api/family/requests/${id}`, { method: "DELETE" }).catch(() => undefined);
  };
  return (
    <section className="flex flex-col gap-3" aria-labelledby="requests-h">
      <h2 id="requests-h" className="font-display text-2xl font-semibold">
        Story requests
      </h2>
      <ul className="flex flex-col gap-2" data-testid="story-requests">
        {open.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-sunshine/30 p-3" data-testid={`request-${r.slug}`}>
            <span className={`block w-12 shrink-0 overflow-hidden rounded-lg ${r.tint}`}>
              {r.coverUrl ? (
                <Image src={r.coverUrl} alt="" width={48} height={64} className="aspect-[3/4] w-full object-cover" />
              ) : (
                <span className="block aspect-[3/4] w-full" />
              )}
            </span>
            <p className="min-w-0 flex-1">
              <strong>{r.childName}</strong> would like <strong>{r.title}</strong>
            </p>
            <Link
              href={r.href}
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-ink px-4 font-display font-semibold text-white hover:-translate-y-0.5"
              data-testid={`prepare-${r.slug}`}
            >
              Prepare it<span className="sr-only">: {r.title}</span>
            </Link>
            <button
              type="button"
              onClick={() => dismiss(r.id)}
              aria-label={`Dismiss ${r.childName}'s request for ${r.title}`}
              className="-mr-1 grid size-11 shrink-0 place-items-center rounded-full text-xl hover:bg-sunshine/50"
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { familyStore } from "@/lib/family/session";
import { activeChild } from "@/lib/family/permissions";
import { familyPage } from "@/lib/family/page-data";
import { kidsShelf } from "@/lib/kids/shelf";
import { childRequests } from "@/lib/family/service";
import { AskButton } from "@/components/family/AskButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Discover more stories | Readli Kids" };

/** Books not prepared for this child yet. A child can peek inside or ask a grown-up for one; nothing here starts preparing or spends credits. */
export default async function KidsDiscover() {
  const page = await familyPage();
  if (!page.enabled) redirect("/kids");
  const actor = page.session?.actor;
  const child = actor?.kind === "child" && page.state ? activeChild(page.state, actor.childId) : null;
  if (!child) redirect("/kids");
  const store = (await familyStore(page.session!))!;
  const { waiting } = await kidsShelf(store, actor!, page.state!, child.id);
  const asked = new Set(await childRequests(store, actor!, child.id));
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/kids" className="inline-flex items-center gap-2 self-start font-display text-lg font-semibold" data-testid="back-link">
        <span aria-hidden="true">‹</span> My stories
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Discover more stories</h1>
        <p className="text-lg text-muted">These aren&apos;t ready yet. Tap a book to peek inside, or tap Ask a grown-up and they&apos;ll see which one you&apos;d like.</p>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6" data-testid="discover-books">
        {waiting.map((b) => (
          <li key={b.slug} className="flex flex-col gap-1.5" data-testid={`discover-${b.slug}`}>
            <Link href={`/kids/discover/${b.slug}`} className="flex flex-1 flex-col gap-1.5" data-testid={`peek-${b.slug}`}>
              <span className={`relative block aspect-[3/4] overflow-hidden rounded-2xl ring-2 ring-ink/10 ${b.tint}`}>
                {b.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- static catalog cover art
                  <img src={b.coverUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center p-2 text-center font-display font-semibold">{b.title}</span>
                )}
                <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 font-display text-xs font-semibold shadow-[0_2px_0_rgb(40_53_72/0.2)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Peek
                </span>
              </span>
              <span className="min-h-[2.5em] flex-1 font-display text-sm leading-tight font-semibold">{b.title}</span>
            </Link>
            <AskButton childId={child.id} bookSlug={b.slug} title={b.title} initial={asked.has(b.slug)} />
          </li>
        ))}
      </ul>
    </main>
  );
}

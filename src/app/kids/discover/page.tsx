import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { familyStore } from "@/lib/family/session";
import { activeChild } from "@/lib/family/permissions";
import { familyPage } from "@/lib/family/page-data";
import { kidsShelf } from "@/lib/kids/shelf";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Discover more stories | Readli Kids" };

/** Books not prepared for this child yet. Nothing here starts preparing or spends credits. */
export default async function KidsDiscover() {
  const page = await familyPage();
  if (!page.enabled) redirect("/kids");
  const actor = page.session?.actor;
  const child = actor?.kind === "child" && page.state ? activeChild(page.state, actor.childId) : null;
  if (!child) redirect("/kids");
  const store = (await familyStore(page.session!))!;
  const { waiting } = await kidsShelf(store, actor!, page.state!, child.id);
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/kids" className="inline-flex items-center gap-2 self-start font-display text-lg font-semibold" data-testid="back-link">
        <span aria-hidden="true">‹</span> My stories
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Discover more stories</h1>
        <p className="text-lg text-muted">These aren&apos;t ready yet. A grown-up can get them ready for you.</p>
      </div>
      <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6" data-testid="discover-books">
        {waiting.map((b) => (
          <li key={b.slug} className="flex flex-col gap-1.5" data-testid={`discover-${b.slug}`}>
            <span className={`relative block aspect-[3/4] overflow-hidden rounded-2xl opacity-80 ring-2 ring-ink/10 ${b.tint}`}>
              {b.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- static catalog cover art
                <img src={b.coverUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center p-2 text-center font-display font-semibold">{b.title}</span>
              )}
            </span>
            <span className="font-display text-sm leading-tight font-semibold">{b.title}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}

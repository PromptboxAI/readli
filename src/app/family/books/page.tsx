import type { Metadata } from "next";
import Link from "next/link";
import { BookCard } from "@/components/family/BookCard";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { familyPage } from "@/lib/family/page-data";
import { guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { familyLibrary, type LibraryCard } from "@/lib/library/discovery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Family library | Readli" };

function Shelf({ id, title, description, books }: { id: string; title: string; description: string; books: LibraryCard[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-h`} data-testid={`collection-${id}`}>
      <div>
        <h2 id={`${id}-h`} className="font-display text-2xl font-semibold">
          {title}
        </h2>
        <p className="text-muted">{description}</p>
      </div>
      {books.length ? (
        <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
          {books.map((b) => (
            <li key={b.slug}>
              <BookCard book={b} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-surface p-3 text-sm">Nothing here yet.</p>
      )}
    </section>
  );
}

/** Family library: the whole catalog, shortest first, in collections (Book Discovery amendment §1). */
export default async function FamilyBooksPage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Sign in as a parent to see your family's books." />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can prepare narration." />;
  const lib = await familyLibrary(store, page.session.actor, householdId);
  return (
    <FamilyShell>
      <PreviewNote />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-semibold">Your family library</h1>
        <p className="text-lg">Every book is here. Choose one to see which storytellers are ready and prepare more.</p>
      </div>
      <Link href="/family/credits" className="flex flex-wrap items-baseline gap-2 self-start rounded-full bg-sky/30 px-4 py-2 font-semibold" data-testid="library-balance">
        <span className="font-display text-xl">{lib.credits.available.toLocaleString("en-US")} Readli credits</span>
        <span className="text-sm underline underline-offset-4">Credits and history</span>
      </Link>
      {lib.newFamily && lib.recommended.length > 0 && (
        <div className="rounded-panel bg-mint/30 p-4">
          <Shelf id="start" title="Start with a short story" description="Hear your family's voices in a few minutes. Each one takes only a few credits." books={lib.recommended} />
        </div>
      )}
      {lib.collections.map((c) => (
        <Shelf key={c.id} {...c} />
      ))}
      <Shelf id="all" title="All books" description="The whole library, shortest first." books={lib.all} />
    </FamilyShell>
  );
}

import { displayCredits } from "@/lib/narration/credits";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookCard } from "@/components/family/BookCard";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { familyPage } from "@/lib/family/page-data";
import { guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { UPCOMING_BOOKS } from "@/lib/library/catalog";
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
        <span className="font-display text-xl">{displayCredits(lib.credits.available, lib.credits.unitsPerCredit).toLocaleString("en-US")} Readli credits</span>
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
      {UPCOMING_BOOKS.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="soon-h" data-testid="collection-coming-soon">
          <div>
            <h2 id="soon-h" className="font-display text-2xl font-semibold">
              Coming soon
            </h2>
            <p className="text-muted">More stories joining the library shortly.</p>
          </div>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {UPCOMING_BOOKS.map((b) => (
              <li key={b.slug} className="flex w-44 shrink-0 flex-col gap-2 rounded-3xl bg-surface p-3 ring-2 ring-ink/10 sm:w-52" data-testid={`soon-${b.slug}`}>
                <Image src={b.coverUrl} alt="" width={180} height={240} className="aspect-[3/4] w-full rounded-2xl object-cover opacity-90" />
                <span className="font-display text-lg font-semibold leading-tight">{b.title}</span>
                <span className="text-sm text-muted">About {b.approxMinutes} min</span>
                <span className="self-start rounded-full bg-ink/10 px-2 py-0.5 text-xs font-bold">Coming soon</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </FamilyShell>
  );
}

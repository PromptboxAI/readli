import { displayCredits } from "@/lib/narration/credits";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookCatalog } from "@/components/family/BookCatalog";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { familyPage } from "@/lib/family/page-data";
import { guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { UPCOMING_BOOKS } from "@/lib/library/catalog";
import { familyLibrary } from "@/lib/library/discovery";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Books | Readli" };

/** Books: the whole family library as one catalog, shortest first, with simple filters and each book's cost to prepare. */
export default async function FamilyBooksPage({ searchParams }: { searchParams: Promise<{ voice?: string }> }) {
  const { voice } = await searchParams;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Sign in as a parent to see your family's books." />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can prepare narration." />;
  const lib = await familyLibrary(store, page.session.actor, householdId);
  // Opened for one storyteller, such as one a parent just approved: books another voice already reads come first.
  const name = voice ? lib.all.flatMap((b) => b.narrators).find((n) => n.voiceId === voice)?.name : undefined;
  const readByOthers = name
    ? lib.all.filter(
        (b) =>
          !["ready", "partial", "preparing"].includes(b.narrators.find((n) => n.voiceId === voice)?.availability ?? "") &&
          b.narrators.some((n) => n.voiceId !== voice && ["ready", "partial"].includes(n.availability)),
      )
    : [];
  return (
    <FamilyShell>
      <PreviewNote />
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-4xl font-semibold">Books</h1>
        <Link href="/family/settings/plan" className="font-semibold" data-testid="library-balance">
          <span className="font-display text-xl">{displayCredits(lib.credits.available, lib.credits.unitsPerCredit).toLocaleString("en-US")} credits available</span>{" "}
          <span className="text-sm underline underline-offset-4">Credits and history</span>
        </Link>
      </div>
      {name && (
        <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-sky/40 p-5" aria-labelledby="for-voice-h" data-testid="prepare-for-voice">
          <h2 id="for-voice-h" className="font-display text-2xl font-semibold">
            Prepare a book in {name}&apos;s voice
          </h2>
          {readByOthers.length > 0 ? (
            <>
              <p>Your kids already know these stories in another voice. Prepare one in {name}&apos;s voice too, and they can switch storytellers in the middle of the book.</p>
              <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
                {readByOthers.map((b) => (
                  <li key={b.slug} className="w-32 shrink-0 sm:w-40">
                    <Link href={`/family/books/${b.slug}?voice=${encodeURIComponent(voice!)}`} className="group flex flex-col gap-1.5" data-testid={`for-voice-${b.slug}`}>
                      {b.coverUrl ? (
                        <Image src={b.coverUrl} alt="" width={160} height={213} className="aspect-[3/4] w-full rounded-2xl object-cover shadow-md group-hover:ring-4 group-hover:ring-ink" />
                      ) : (
                        <span className={`flex aspect-[3/4] w-full items-center justify-center rounded-2xl p-3 text-center font-display font-semibold ${b.tint}`}>{b.title}</span>
                      )}
                      <span className="line-clamp-2 font-display leading-tight font-semibold group-hover:underline">{b.title}</span>
                      <span className="text-sm text-muted">
                        Read by {b.narrators.filter((n) => n.voiceId !== voice && ["ready", "partial"].includes(n.availability)).map((n) => n.name).join(", ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">Or pick any book below. Costs below are for {name}.</p>
            </>
          ) : (
            <p>Pick any book below. Costs are shown for {name}, and the book opens with {name} chosen as narrator.</p>
          )}
        </section>
      )}
      <BookCatalog books={lib.all} initialVoice={name ? voice : null} unitsPerCredit={lib.credits.unitsPerCredit} quickMaxMinutes={store.plan.quickStoryMaxMinutes} bedtime={store.plan.bedtimeFavorites} />
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
              <li key={b.slug} className="flex w-36 shrink-0 flex-col gap-1.5 sm:w-44" data-testid={`soon-${b.slug}`}>
                <Image src={b.coverUrl} alt="" width={180} height={240} className="aspect-[3/4] w-full rounded-2xl object-cover opacity-90" />
                <span className="font-display text-lg leading-tight font-semibold">{b.title}</span>
                <span className="text-sm text-muted">About {b.approxMinutes} min · coming soon</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </FamilyShell>
  );
}

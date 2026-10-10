import type { Metadata } from "next";
import Link from "next/link";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { DEMO_BOOKS } from "@/lib/content/demo-books";
import { familyPage } from "@/lib/family/page-data";
import { guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { prepareView } from "@/lib/narration/narration";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Family books | Readli" };

/** Family library: each book with how many of the family's voices are ready to read it. */
export default async function FamilyBooksPage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Sign in as a parent to see your family's books." />;
  const store = (await familyStore(page.session.sandbox))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can prepare narration." />;
  const books = await Promise.all(
    DEMO_BOOKS.filter((b) => b.passageText).map(async (b) => ({ book: b, view: await prepareView(store, page.session!.actor, householdId, b.slug) })),
  );
  return (
    <FamilyShell>
      <PreviewNote />
      <h1 className="font-display text-4xl font-semibold">Your family&apos;s books</h1>
      <p className="text-lg">Choose a book to see which storytellers are ready to read it, and prepare more.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {books.map(({ book, view }) => {
          const ready = view.voices.filter((v) => v.status.readiness === "ready").map((v) => v.name);
          return (
            <li key={book.slug}>
              <Link href={`/family/books/${book.slug}`} className="flex h-full flex-col gap-1 rounded-3xl bg-surface p-5 ring-2 ring-ink/10 hover:ring-ink">
                <span className="font-display text-xl font-semibold">{book.title}</span>
                <span className="text-sm text-muted">{ready.length ? `Ready in ${ready.join(", ")}'s voice${ready.length > 1 ? "s" : ""}` : "No voices prepared yet"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </FamilyShell>
  );
}

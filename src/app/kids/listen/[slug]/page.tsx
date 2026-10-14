import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FamilyOff, NeedsGrownUp } from "@/components/family/FamilyShell";
import { KidsPlayer } from "@/components/family/KidsPlayer";
import { findCatalogBook } from "@/lib/library/catalog";
import { activeChild } from "@/lib/family/permissions";
import { familyPage } from "@/lib/family/page-data";
import { childBookState, narratorsFor } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { kidsReadiness } from "@/lib/narration/narration";
import { bookText } from "@/lib/narration/text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Story time | Readli Kids" };

export default async function KidsListen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = findCatalogBook(slug);
  if (!book) notFound();
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const session = page.session;
  const child = session?.actor.kind === "child" && page.state ? activeChild(page.state, session.actor.childId) : null;
  // A kids device where nobody has picked who's listening goes back to the picker.
  if (session?.device && !child) redirect("/kids");
  if (!session || !child) return <NeedsGrownUp text="A grown-up opens your Readli Kids bookshelf for you." />;
  const store = (await familyStore(session))!;
  const narrators = await narratorsFor(store, session.actor, child.id);
  const resume = await childBookState(store, session.actor, child.id, book.slug);
  const readiness = await kidsReadiness(store, session.actor, child.id, book.slug);
  const text = bookText(book.slug)!;
  return (
    <KidsPlayer
      childId={child.id}
      childName={child.nickname}
      book={{ slug: book.slug, title: book.title, coverUrl: book.coverUrl }}
      sentences={text.sentences.map((x) => x.text)}
      sentenceIds={text.sentences.map((x) => x.id)}
      initialReadiness={readiness}
      initialNarrators={narrators}
      resume={resume}
      preview={!session.account}
    />
  );
}

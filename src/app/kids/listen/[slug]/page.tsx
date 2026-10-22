import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FamilyOff, NeedsGrownUp } from "@/components/family/FamilyShell";
import { KidsPlayer } from "@/components/family/KidsPlayer";
import { findCatalogBook } from "@/lib/library/catalog";
import { activeChild } from "@/lib/family/permissions";
import { familyPage } from "@/lib/family/page-data";
import { narratorsFor } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { bookTexts, kidsResume, kidsReadiness } from "@/lib/narration/narration";

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
  const readiness = await kidsReadiness(store, session.actor, child.id, book.slug);
  const saved = page.state?.progress.find((p) => p.childId === child.id && p.bookSlug === book.slug);
  const voiceId = narrators.find((n) => n.voiceId === saved?.voiceId)?.voiceId ?? narrators[0]?.voiceId ?? null;
  // The saved place, counted in the text this narrator's audiobook reads.
  const resume = await kidsResume(store, session.actor, child.id, book.slug, voiceId);
  const texts = bookTexts(book.slug, readiness.map((r) => r.revision), store.plan.narrationModelId);
  return (
    <KidsPlayer
      childId={child.id}
      childName={child.nickname}
      book={{ slug: book.slug, title: book.title, coverUrl: book.coverUrl }}
      texts={texts}
      initialReadiness={readiness}
      initialNarrators={narrators}
      resume={resume}
      preview={!session.account}
    />
  );
}

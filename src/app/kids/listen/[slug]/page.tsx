import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FamilyOff, NeedsGrownUp } from "@/components/family/FamilyShell";
import { KidsPlayer } from "@/components/family/KidsPlayer";
import { findDemoBook } from "@/lib/content/demo-books";
import { sentencesOf } from "@/lib/content/sentences";
import { activeChild } from "@/lib/family/permissions";
import { familyPage } from "@/lib/family/page-data";
import { narratorsFor } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Story time | Readli Kids" };

export default async function KidsListen({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = findDemoBook(slug);
  if (!book?.passageText) notFound();
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const session = page.session;
  const child = session?.actor.kind === "child" && page.state ? activeChild(page.state, session.actor.childId) : null;
  if (!session || !child) return <NeedsGrownUp text="A grown-up opens your Readli Kids bookshelf for you." />;
  const narrators = await narratorsFor(familyStore(session.sandbox)!, session.actor, child.id);
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/kids" className="self-start font-display font-semibold underline underline-offset-4">
        ← My stories
      </Link>
      <h1 className="font-display text-4xl font-semibold">{book.title}</h1>
      <KidsPlayer
        childId={child.id}
        childName={child.nickname}
        book={{ slug: book.slug, title: book.title }}
        sentences={sentencesOf(book.passageText)}
        initialNarrators={narrators}
      />
    </main>
  );
}

import type { Metadata } from "next";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { PrepareNarration } from "@/components/family/PrepareNarration";
import { familyPage } from "@/lib/family/page-data";
import { guardianHousehold, PermissionError } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { prepareView } from "@/lib/narration/narration";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Prepare audiobook | Readli" };

type Search = { voice?: string; scope?: string; chapter?: string; from?: string };

export default async function PrepareNarrationPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  const { slug } = await params;
  const q = await searchParams;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can prepare narration." />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can prepare narration." />;
  try {
    const view = await prepareView(store, page.session.actor, householdId, slug);
    return (
      <FamilyShell wide>
        <PreviewNote />
        {q.from === "setup" && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-sunshine/50 px-4 py-3" data-testid="setup-book-banner">
            <span className="min-w-0 flex-1">Setting up, step 4 of 4: choose who reads this book and prepare it. Then come back to finish.</span>
            <Link href="/family/setup?step=book" className="font-semibold underline underline-offset-4">
              Back to setup
            </Link>
          </p>
        )}
        <PrepareNarration initial={view} resume={resumeTarget(q, view.voices.map((v) => v.voiceId))} prefer={q.voice ?? null} />
      </FamilyShell>
    );
  } catch (err) {
    if (err instanceof PermissionError && err.status === 404) notFound();
    throw err;
  }
}

/** After buying credits, the parent returns here with their book, narrator and scope already chosen. */
function resumeTarget(q: Search, voices: string[]) {
  if (!q.voice || !voices.includes(q.voice)) return null;
  if (q.scope === "chapter" && Number.isInteger(Number(q.chapter))) return { voiceId: q.voice, scope: "chapter" as const, chapter: Number(q.chapter) };
  return q.scope === "book" ? { voiceId: q.voice, scope: "book" as const } : null;
}

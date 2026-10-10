import type { Metadata } from "next";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { PrepareNarration } from "@/components/family/PrepareNarration";
import { familyPage } from "@/lib/family/page-data";
import { guardianHousehold, PermissionError } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { prepareView } from "@/lib/narration/narration";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Prepare narration | Readli" };

export default async function PrepareNarrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can prepare narration." />;
  const store = (await familyStore(page.session.sandbox))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can prepare narration." />;
  try {
    const view = await prepareView(store, page.session.actor, householdId, slug);
    return (
      <FamilyShell>
        <PreviewNote />
        <PrepareNarration initial={view} />
      </FamilyShell>
    );
  } catch (err) {
    if (err instanceof PermissionError && err.status === 404) notFound();
    throw err;
  }
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FamilyOff, NeedsGrownUp } from "@/components/family/FamilyShell";
import { GrownUpPlayer } from "@/components/family/GrownUpPlayer";
import { familyPage } from "@/lib/family/page-data";
import { guardianHousehold, PermissionError } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { listenView } from "@/lib/narration/narration";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Listen | Readli" };

/** The grown-up player: a prepared book in any voice the family may use. */
export default async function ListenPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ voice?: string }> }) {
  const { slug } = await params;
  const { voice } = await searchParams;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can listen here." />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can listen here." />;
  try {
    const view = await listenView(store, page.session.actor, householdId, slug);
    // Full screen like the Readli Kids player, so the whole story fits on a phone or iPad.
    return (
      <GrownUpPlayer
        view={view}
        initialVoice={view.voices.some((v) => v.voiceId === voice) ? voice! : (view.voices[0]?.voiceId ?? null)}
        preview={!page.session.account}
      />
    );
  } catch (err) {
    if (err instanceof PermissionError && err.status === 404) notFound();
    throw err;
  }
}

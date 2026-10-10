import type { Metadata } from "next";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { NarratorSlots } from "@/components/family/NarratorSlots";
import { familyPage } from "@/lib/family/page-data";
import { guardianHousehold, narratorSlots } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Narrator slots | Readli" };

export default async function NarratorSlotsPage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can manage narrator slots." />;
  const store = (await familyStore(page.session.sandbox))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can manage narrator slots." />;
  return (
    <FamilyShell>
      <PreviewNote />
      <NarratorSlots initial={await narratorSlots(store, page.session.actor, householdId)} />
    </FamilyShell>
  );
}

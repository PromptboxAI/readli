import type { Metadata } from "next";
import { ChildProfiles } from "@/components/family/ChildProfiles";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { familyPage } from "@/lib/family/page-data";
import { childProfiles, guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kids profiles | Readli" };

export default async function ChildProfilesPage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can manage kids profiles." />;
  const store = (await familyStore(page.session.sandbox))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can manage kids profiles." />;
  return (
    <FamilyShell>
      <PreviewNote />
      <ChildProfiles initial={await childProfiles(store, page.session.actor, householdId)} />
    </FamilyShell>
  );
}

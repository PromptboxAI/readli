import type { Metadata } from "next";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { NarratorSlots } from "@/components/family/NarratorSlots";
import { familyPage } from "@/lib/family/page-data";
import type { FamilyState } from "@/lib/family/model";
import { guardianHousehold, narratorSlots } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { BackLink } from "@/components/family/BackLink";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Narrator slots | Readli" };

export default async function NarratorSlotsPage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can manage narrator slots." />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can manage narrator slots." />;
  return (
    <FamilyShell>
      <PreviewNote />
      <BackLink href="/family" label="Family" />
      <NarratorSlots initial={await narratorSlots(store, page.session.actor, householdId)} canBuy={!page.session.account} approveHref={approveHref(page.state, householdId)} />
    </FamilyShell>
  );
}

/** Where a parent approves storytellers: straight to the only child, or the list of children. */
function approveHref(state: FamilyState | null, householdId: string): string {
  const kids = state?.children.filter((c) => c.householdId === householdId && c.deletedAt === null) ?? [];
  return kids.length === 1 ? `/family/kids/${kids[0]!.id}/storytellers` : "/family/kids";
}

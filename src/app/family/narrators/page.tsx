import type { Metadata } from "next";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { NarratorSlots } from "@/components/family/NarratorSlots";
import { accountDb } from "@/lib/family/account-store";
import { familyPage, guardianChildren } from "@/lib/family/page-data";
import type { FamilyState } from "@/lib/family/model";
import { guardianHousehold, narratorSlots } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { BackLink } from "@/components/family/BackLink";
import { invitationMailer } from "@/lib/invitations/email";
import { inviteEmailOn } from "@/lib/invites/email";
import { listInvites } from "@/lib/invites/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Family storytellers | Readli" };

export default async function NarratorSlotsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const add = (await searchParams).add;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can manage narrator slots." />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  if (!householdId) return <NeedsGrownUp text="Only a parent or guardian can manage narrator slots." />;
  // Signed-in families save real invitations; the sample family previews the form without saving.
  const db = page.session.account ? accountDb() : null;
  const inviteMode = page.session.account ? (db ? "live" : "off") : "preview";
  const email = db ? await inviteEmailOn(db, invitationMailer()) : null;
  const invites = db ? await listInvites(db, householdId, { maxResends: email?.on ? email.maxResends : null }) : [];
  return (
    <FamilyShell>
      <PreviewNote />
      <BackLink href="/family/controls" label="Parent Controls" />
      <NarratorSlots
        initial={await narratorSlots(store, page.session.actor, householdId)}
        canBuy={!page.session.account}
        approveHref={approveHref(page.state, householdId)}
        inviteMode={inviteMode}
        invites={invites}
        kids={guardianChildren(page.state!, page.session.actor.adultId).filter((c) => c.householdId === householdId).map((c) => ({ id: c.id, name: c.nickname }))}
        focus={typeof add === "string" ? add : null}
      />
    </FamilyShell>
  );
}

/** Where a parent approves storytellers: straight to the only child, or the list of children. */
function approveHref(state: FamilyState | null, householdId: string): string {
  const kids = state?.children.filter((c) => c.householdId === householdId && c.deletedAt === null) ?? [];
  return kids.length === 1 ? `/family/kids/${kids[0]!.id}/storytellers` : "/family/kids";
}

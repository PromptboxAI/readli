import type { Metadata } from "next";
import { FamilyParents } from "@/components/family/FamilyParents";
import { FamilyOff, NeedsGrownUp } from "@/components/family/FamilyShell";
import { SettingsShell } from "@/components/family/SettingsShell";
import { accountDb } from "@/lib/family/account-store";
import { familyPage } from "@/lib/family/page-data";
import { familyParents, guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";
import { listInvites } from "@/lib/invites/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parents | Readli", robots: { index: false } };

const NOT_GUARDIAN = "Only a parent or guardian can see your family's parents.";

/**
 * The family's parents. The parent who manages the plan invites a co-parent here: they get every
 * parent's controls on their own sign-in (storytellers, books, Readli Kids on their devices), but not
 * billing. Recording their own voice stays optional.
 */
export default async function ParentsPage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const session = page.session;
  if (session?.actor.kind !== "adult") return <NeedsGrownUp text={NOT_GUARDIAN} />;
  const store = (await familyStore(session))!;
  const householdId = await guardianHousehold(store, session.actor);
  if (!householdId) return <NeedsGrownUp text={NOT_GUARDIAN} />;
  const view = await familyParents(store, session.actor, householdId);
  const db = session.account ? accountDb() : null;
  const invites = db && view.youOwn ? (await listInvites(db, householdId, { role: "guardian" })).filter((i) => i.status === "invited") : [];
  return (
    <SettingsShell current="parents" guardian>
      <FamilyParents view={view} initialInvites={invites} live={Boolean(db)} />
    </SettingsShell>
  );
}

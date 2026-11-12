import type { Metadata } from "next";
import { AccountSection } from "@/components/account/AccountSection";
import { FamilyOff, NeedsGrownUp } from "@/components/family/FamilyShell";
import { SettingsShell } from "@/components/family/SettingsShell";
import { listDevices } from "@/lib/family/devices";
import { familyPage } from "@/lib/family/page-data";
import { activeEntitlement } from "@/lib/family/permissions";
import { householdOwner } from "@/lib/family/service";
import { settingsHousehold } from "@/lib/family/settings-access";
import { settingsBack, type SettingsSection } from "@/lib/family/settings-nav";
import { deviceRegistry, familyStore } from "@/lib/family/session";
import { creditBalance, displayCredits } from "@/lib/narration/credits";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings | Readli" };

/** Settings home: the Account section on desktop, the list of sections on phones. */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind === "child") return <NeedsGrownUp text="Only a grown-up can change settings." />;
  const householdId = settingsHousehold(page);
  return (
    <SettingsShell current="account" guardian={Boolean(householdId)} back={settingsBack((await searchParams).from)} list={householdId ? await summaries(page, householdId) : undefined}>
      <AccountSection state={page.state} />
    </SettingsShell>
  );
}

/** One line under each section on the phone list, so a parent sees their plan and devices at a glance. */
async function summaries(page: Extract<Awaited<ReturnType<typeof familyPage>>, { enabled: true }>, householdId: string): Promise<Partial<Record<SettingsSection, string>>> {
  const session = page.session!;
  const store = (await familyStore(session))!;
  const state = page.state!;
  const credits = creditBalance(state, store.plan, householdId);
  const left = `${displayCredits(credits.available, credits.unitsPerCredit).toLocaleString("en-US")} credits left`;
  const registry = deviceRegistry(Boolean(session.account));
  const devices = registry ? (await listDevices(registry, state, session.actor, householdId)).filter((d) => d.status === "active").length : null;
  const hasPin = registry ? Boolean(await registry.pinHash(householdId)) : false;
  const parents = state.members.filter((m) => m.householdId === householdId && m.role === "guardian" && m.removedAt === null).length;
  const owner = householdOwner(state, householdId) === (session.actor.kind === "adult" ? session.actor.adultId : null);
  return {
    account: "Photo, name, emails and your data",
    parents: parents > 1 ? `${parents} parents${owner ? " · you manage the plan" : ""}` : "Invite a co-parent",
    plan: activeEntitlement(state, householdId) ? `Readli Family · ${left}` : `No plan yet · ${left}`,
    "kids-mode": devices === null ? "Family PIN and kids devices" : `${hasPin ? "PIN set" : "No PIN yet"} · ${devices} ${devices === 1 ? "device" : "devices"}`,
  };
}

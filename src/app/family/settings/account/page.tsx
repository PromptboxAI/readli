import type { Metadata } from "next";
import { AccountSection } from "@/components/account/AccountSection";
import { FamilyOff, NeedsGrownUp } from "@/components/family/FamilyShell";
import { SettingsShell } from "@/components/family/SettingsShell";
import { familyPage } from "@/lib/family/page-data";
import { settingsHousehold } from "@/lib/family/settings-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account | Readli" };

/** The Account section on its own, opened from the phone list of Settings. */
export default async function AccountSettingsPage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind === "child") return <NeedsGrownUp text="Only a grown-up can change settings." />;
  return (
    <SettingsShell current="account" guardian={Boolean(settingsHousehold(page))}>
      <AccountSection state={page.state} />
    </SettingsShell>
  );
}

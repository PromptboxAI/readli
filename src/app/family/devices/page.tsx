import type { Metadata } from "next";
import { KidsDevices } from "@/components/family/KidsDevices";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { DEVICE_IDLE_DAYS, listDevices } from "@/lib/family/devices";
import { familyPage, guardianChildren } from "@/lib/family/page-data";
import { guardianHousehold } from "@/lib/family/service";
import { deviceRegistry, familyStore, TEMPORARY_KIDS_HOURS } from "@/lib/family/session";
import { BackLink } from "@/components/family/BackLink";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kids devices and PIN | Readli" };

export default async function KidsDevicesPage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  const session = page.session;
  if (session?.actor.kind !== "adult" || !page.state) return <NeedsGrownUp text="Only a parent or guardian can manage kids devices." />;
  const store = (await familyStore(session))!;
  const householdId = await guardianHousehold(store, session.actor);
  const registry = deviceRegistry(Boolean(session.account));
  if (!householdId || !registry) return <NeedsGrownUp text="Only a parent or guardian can manage kids devices." />;
  const kids = guardianChildren(page.state, session.actor.adultId)
    .filter((c) => c.householdId === householdId)
    .map((c) => ({ id: c.id, nickname: c.nickname }));
  return (
    <FamilyShell>
      <PreviewNote />
      <BackLink href="/family/controls" label="Parent Controls" />
      <KidsDevices
        kids={kids}
        initialDevices={await listDevices(registry, page.state, session.actor, householdId)}
        pinSet={Boolean(await registry.pinHash(householdId))}
        temporaryHours={TEMPORARY_KIDS_HOURS}
        idleDays={DEVICE_IDLE_DAYS}
      />
    </FamilyShell>
  );
}

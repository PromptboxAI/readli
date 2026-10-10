import type { Metadata } from "next";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { ManageStorytellers } from "@/components/family/ManageStorytellers";
import { familyPage } from "@/lib/family/page-data";
import { manageStorytellers, PermissionError } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage storytellers | Readli" };

export default async function ManageStorytellersPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can choose storytellers." />;
  try {
    const view = await manageStorytellers((await familyStore(page.session.sandbox))!, page.session.actor, childId);
    return (
      <FamilyShell>
        <PreviewNote />
        <ManageStorytellers initial={view} />
      </FamilyShell>
    );
  } catch (err) {
    if (err instanceof PermissionError) return <NeedsGrownUp text={err.userMessage} />;
    throw err;
  }
}

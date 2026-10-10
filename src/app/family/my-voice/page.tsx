import type { Metadata } from "next";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { MyVoiceSharing } from "@/components/family/MyVoiceSharing";
import { familyPage } from "@/lib/family/page-data";
import { myVoices } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Who can use my voice | Readli" };

export default async function MyVoicePage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Sign in to manage your voice." />;
  const voices = await myVoices((await familyStore(page.session))!, page.session.actor);
  return (
    <FamilyShell>
      <PreviewNote />
      <h1 className="font-display text-4xl font-semibold">Who can use my voice</h1>
      <p className="max-w-2xl text-lg">
        Your voice is private by default. Sharing it with a family makes it available to that family&apos;s parents,
        who then choose, child by child, whether their kids can hear it. Being connected on a family tree never shares
        it. You can stop sharing at any time.
      </p>
      <MyVoiceSharing initial={voices} />
    </FamilyShell>
  );
}

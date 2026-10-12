import type { Metadata } from "next";
import Link from "next/link";
import { buttonSecondary } from "@/components/brand/buttons";
import { FamilyOff, FamilyShell, NeedsGrownUp, PreviewNote } from "@/components/family/FamilyShell";
import { AccountVoiceControls } from "@/components/family/AccountVoiceControls";
import { MyVoiceSharing } from "@/components/family/MyVoiceSharing";
import { currentUser } from "@/lib/auth/supabase";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";
import { familyPage } from "@/lib/family/page-data";
import { myVoices } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My voice | Readli" };

export default async function MyVoicePage() {
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Sign in to manage your voice." />;
  const voices = await myVoices((await familyStore(page.session))!, page.session.actor);
  // A signed-in grown-up manages their real recording here; the preview family has none.
  const deps = page.session.account ? accountVoiceDeps(serverConfig()) : null;
  const user = deps ? await currentUser() : null;
  const recording = deps && user ? await deps.store.findVoice(user.id).catch(() => null) : null;
  return (
    <FamilyShell>
      <PreviewNote />
      <h1 className="font-display text-4xl font-semibold">My voice</h1>
      {user && <AccountVoiceControls voice={recording && { status: recording.status, version: recording.version, updatedAt: recording.updatedAt }} />}
      {recording?.status === "ready" && (
        <section className="flex flex-col items-start gap-3 rounded-[var(--radius-panel)] bg-sky/40 p-6" data-testid="invite-family-card">
          <h2 className="font-display text-2xl font-semibold">Invite your family</h2>
          <p className="max-w-2xl">Send the grown-ups in your family a short story in your voice. They can listen without an account and start a free Readli Family trial.</p>
          <Link href="/voice/invite" className={buttonSecondary}>
            Invite your family
          </Link>
        </section>
      )}
      <h2 className="font-display text-2xl font-semibold">Who can use it</h2>
      <p className="max-w-2xl text-lg">
        Your voice is private by default. Sharing it with a family makes it available to that family&apos;s parents,
        who then choose, child by child, whether their kids can hear it. Being connected on a family tree never shares
        it. You can stop sharing at any time.
      </p>
      <MyVoiceSharing initial={voices} />
    </FamilyShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AskName } from "@/components/account/AskName";
import { ContributorDashboard } from "@/components/accounts/ContributorDashboard";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { AccountVoiceControls } from "@/components/family/AccountVoiceControls";
import { MyVoiceSharing } from "@/components/family/MyVoiceSharing";
import { VoiceModelUpgrade } from "@/components/family/VoiceModelUpgrade";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { chosenName } from "@/lib/account/names";
import { currentAdult } from "@/lib/auth/adult";
import { familyPage } from "@/lib/family/page-data";
import { myVoices } from "@/lib/family/service";
import { familyAccountsEnabled, familyStore } from "@/lib/family/session";
import { isParent } from "@/lib/family/storyteller";
import { pendingJoinPath } from "@/lib/invites/pending";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps, voiceModelStatus } from "@/lib/voice/account-voices";

export const metadata: Metadata = { title: "My voice | Readli Voice", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The free storyteller's home: their voice and the families using it. No family setup, children,
 * plans or credits: those belong to each family's own account. Parents manage their voice inside
 * Readli Family instead. Older invitation links (/voice?invite=) go to the join page.
 */
export default async function VoiceHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  if (typeof p.invite === "string" && p.invite) redirect(`/voice/join?invite=${encodeURIComponent(p.invite)}`);
  const user = familyAccountsEnabled() ? await currentAdult() : null;
  if (!user) {
    return (
      <AdultPage>
        <PreviewNote>This is an example Readli Voice dashboard. Nothing here changes a real voice.</PreviewNote>
        <ContributorDashboard invited={false} />
      </AdultPage>
    );
  }
  const page = await familyPage();
  if (!page.enabled || !page.session || page.session.actor.kind !== "adult") return redirect("/login?next=/voice");
  const { session, state } = page;
  if (isParent(state, user.id)) redirect("/family/my-voice");
  // An invitation this browser was in the middle of accepting comes first.
  const pending = await pendingJoinPath(user.id);
  if (pending) redirect(pending);

  const voices = await myVoices((await familyStore(session))!, session.actor);
  const deps = accountVoiceDeps(serverConfig());
  const recording = deps ? await deps.store.findVoice(user.id).catch(() => null) : null;
  const model = deps ? await voiceModelStatus(deps, user.id).catch(() => null) : null;
  // Just back from saving the voice (Save My Voice Free): confirm it, lead with inviting family, and
  // ask what to call them now that nothing is waiting on it.
  const justSaved = p.saved === "1" && recording?.status === "ready";
  const me = state?.adults.find((a) => a.id === user.id);
  const named = Boolean(chosenName(me?.displayName ?? user.name, user.email));
  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Eyebrow>Readli Voice · Free storyteller account</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Your voice</h1>
      </header>
      {justSaved && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-mint/50 p-6 sm:p-8" aria-labelledby="saved-h" data-testid="voice-saved">
          <div className="flex items-center gap-4">
            <ReadiMascot size={80} decorative />
            <div>
              <h2 id="saved-h" className="font-display text-2xl font-semibold sm:text-3xl">
                Your voice is saved
              </h2>
              <p>It&apos;s private until you share it. Invite your family so their kids can hear stories read by you.</p>
            </div>
          </div>
          <Link href="/voice/invite" className={`${buttonPrimary} self-start`}>
            Invite your family
          </Link>
        </section>
      )}
      {justSaved && !named && <AskName />}
      {model?.canUpgrade && <VoiceModelUpgrade />}
      <AccountVoiceControls voice={recording && { status: recording.status, version: recording.version, updatedAt: recording.updatedAt }} />
      <section className="flex flex-col gap-3" aria-labelledby="families-h">
        <h2 id="families-h" className="font-display text-2xl font-semibold">
          Families using your voice
        </h2>
        <MyVoiceSharing initial={voices} storyteller />
      </section>
      {recording?.status === "ready" && (
        <section className="flex flex-col items-start gap-3 rounded-[var(--radius-panel)] bg-sky/40 p-6" data-testid="invite-family-card">
          <h2 className="font-display text-2xl font-semibold">Share your voice with another family</h2>
          <p className="max-w-2xl">
            Send a family a link. They use their own Readli Family account, which they pay for, then add you as a narrator. You won&apos;t
            record again.
          </p>
          <Link href="/voice/invite" className={buttonSecondary}>
            Share my voice
          </Link>
        </section>
      )}
      <form action="/auth/signout" method="post">
        <button type="submit" className={buttonSecondary}>
          Sign out
        </button>
      </form>
    </AdultPage>
  );
}

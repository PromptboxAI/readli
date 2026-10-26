import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AskName } from "@/components/account/AskName";
import { ContributorDashboard } from "@/components/accounts/ContributorDashboard";
import { buttonSecondary } from "@/components/brand/buttons";
import { AccountVoiceControls } from "@/components/family/AccountVoiceControls";
import { MyVoiceSharing } from "@/components/family/MyVoiceSharing";
import { InvitationList } from "@/components/invitations/InvitationList";
import { VoiceModelUpgrade } from "@/components/family/VoiceModelUpgrade";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { chosenName } from "@/lib/account/names";
import { currentAdult } from "@/lib/auth/adult";
import { familyPage } from "@/lib/family/page-data";
import { myVoices } from "@/lib/family/service";
import { familyAccountsEnabled, familyStore } from "@/lib/family/session";
import { isParent } from "@/lib/family/storyteller";
import { invitationContext } from "@/lib/invitations/context";
import { invitationSettings, listInvitations } from "@/lib/invitations/server";
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
  const me = state?.adults.find((a) => a.id === user.id);
  const named = Boolean(chosenName(me?.displayName ?? user.name, user.email));
  // Invitations sent and how each is doing: sent, opened, connected.
  const ctx = invitationContext();
  const invitations = ctx ? await listInvitations(ctx.db, ctx.secret, user.id, await invitationSettings(ctx.db)).catch(() => []) : [];
  const ready = recording?.status === "ready";
  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Eyebrow>Readli Voice · Free storyteller account</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">My Voice</h1>
      </header>
      {!named && <AskName label="What should families call you?" hint="Invitations use this name, like “Grandpa Joe has a bedtime story for your family.”" placeholder="Grandpa Joe, Nana, Aunt Sue…" />}
      {model?.canUpgrade && <VoiceModelUpgrade />}
      <AccountVoiceControls voice={recording && { status: recording.status, version: recording.version, updatedAt: recording.updatedAt }} />
      <section className="flex flex-col gap-3" aria-labelledby="families-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="families-h" className="font-display text-2xl font-semibold">
            Families using your voice
          </h2>
          {ready && (
            <Link href="/voice/invite" className="font-display font-semibold underline underline-offset-4" data-testid="invite-family">
              Invite a family
            </Link>
          )}
        </div>
        <MyVoiceSharing initial={voices} storyteller />
      </section>
      {invitations.length > 0 && <InvitationList items={invitations} />}
      <form action="/auth/signout" method="post">
        <button type="submit" className={buttonSecondary}>
          Sign out
        </button>
      </form>
    </AdultPage>
  );
}

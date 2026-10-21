import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { JoinInvite } from "@/components/invites/JoinInvite";
import { currentAdult } from "@/lib/auth/adult";
import { accountDb } from "@/lib/family/account-store";
import { familyAccountsEnabled } from "@/lib/family/session";
import { inviteForToken } from "@/lib/invites/server";

export const metadata: Metadata = { title: "Join as a storyteller | Readli Voice", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Where a family's storyteller invitation lands. Signed out: sign in or create a free Readli Voice
 * account with the invitation kept in the sign-in link. Signed in: accept, then record and share.
 * Accepting adds family membership only; it shares no voice and approves no child.
 */
export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const token = typeof p.invite === "string" ? p.invite : "";
  const db = familyAccountsEnabled() ? accountDb() : null;
  const user = db ? await currentAdult() : null;
  const invite = db && token ? await inviteForToken(db, token, user?.id ?? null) : null;
  if (user && invite?.alreadyMember && invite.householdId) redirect(`/voice/join/${invite.householdId}`);
  return (
    <AdultPage>
      <header className="flex flex-col gap-2">
        <Eyebrow>Readli Voice · Free</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          {invite ? `${invite.inviterName} invited you to read stories to ${invite.familyName}` : "Storyteller invitation"}
        </h1>
      </header>
      <JoinInvite token={token} invite={invite} signedIn={Boolean(user)} live={Boolean(db)} />
    </AdultPage>
  );
}

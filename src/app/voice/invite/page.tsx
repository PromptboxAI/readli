import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonPrimary } from "@/components/brand/buttons";
import { InvitationList } from "@/components/invitations/InvitationList";
import { InviteComposer } from "@/components/invitations/InviteComposer";
import { PreviewPicker, type PickerBook } from "@/components/invitations/PreviewPicker";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { currentAdult } from "@/lib/auth/adult";
import { invitationContext } from "@/lib/invitations/context";
import { PREVIEW_PASSAGES } from "@/lib/invitations/passages";
import { ADULTS_CONSENT, SHARE_CONSENT, contributorState, listInvitations } from "@/lib/invitations/server";
import { findCatalogBook } from "@/lib/library/catalog";

export const metadata: Metadata = { title: "Invite your family | Readli Voice", robots: { index: false } };
export const dynamic = "force-dynamic";

const BLOCKERS = {
  no_voice: "Record your Readli voice first. Then you can choose what your family hears.",
  voice_processing: "Your voice is still being made. Come back in a minute.",
  email_unconfirmed: "Confirm your email address first, using the link we sent you.",
} as const;

function pickerBooks(): PickerBook[] {
  const books = new Map<string, PickerBook>();
  for (const p of PREVIEW_PASSAGES) {
    const b = findCatalogBook(p.book);
    if (!b) continue;
    if (!books.has(b.slug)) books.set(b.slug, { slug: b.slug, title: b.title, author: b.author, coverUrl: b.coverUrl, passages: [] });
    books.get(b.slug)!.passages.push({ id: p.id, text: p.text });
  }
  return [...books.values()];
}

/** Readli Voice: invite adult family members to hear your voice and start a Readli Family trial. */
export default async function InviteFamilyPage() {
  const ctx = invitationContext();
  const header = (
    <header className="flex flex-col gap-2">
      <Link href="/family/my-voice" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
        ← My voice
      </Link>
      <Eyebrow>Readli Voice · Free</Eyebrow>
      <h1 className="font-display text-4xl font-semibold sm:text-5xl">Invite your family</h1>
      <p className="max-w-2xl text-lg">Let the grown-ups in your family hear a story in your voice. If they start Readli Family, you can read to their kids, with their say-so for each child.</p>
    </header>
  );
  if (!ctx) {
    return (
      <AdultPage wide>
        {header}
        <PreviewNote>Family invitations need Readli accounts, which aren&apos;t switched on here. See how it will look at /design/invitations.</PreviewNote>
      </AdultPage>
    );
  }
  const user = await currentAdult();
  if (!user) redirect(`/login?next=${encodeURIComponent("/voice/invite")}`);
  const state = await contributorState(ctx.db, ctx.deps, user);
  if (state.blocker) {
    return (
      <AdultPage wide>
        {header}
        <section className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] bg-sunshine/50 p-6" data-testid="invite-blocker">
          <p className="text-lg">{BLOCKERS[state.blocker]}</p>
          {state.blocker === "no_voice" && (
            <Link href="/family/my-voice" className={buttonPrimary}>
              Record my voice
            </Link>
          )}
        </section>
      </AdultPage>
    );
  }
  const invitations = await listInvitations(ctx.db, ctx.secret, user.id, state.settings);
  const sendingOff = !state.settings.sendingEnabled || !ctx.mailer;
  return (
    <AdultPage wide>
      {header}
      <PreviewPicker books={pickerBooks()} approved={state.approved} draft={state.draft} />
      <InviteComposer
        maxPerSend={state.settings.maxRecipientsPerSend}
        linkDays={state.settings.linkDays}
        shareConsent={SHARE_CONSENT}
        adultsConsent={ADULTS_CONSENT}
        disabled={sendingOff ? "Sending invitations switches on soon. You can choose and approve your preview now." : !state.approved ? "Approve your preview above, then you can send invitations." : null}
      />
      <InvitationList items={invitations} />
    </AdultPage>
  );
}

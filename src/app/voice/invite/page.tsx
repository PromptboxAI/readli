import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { InviteComposer } from "@/components/invitations/InviteComposer";
import { PreviewPicker, type PickerBook } from "@/components/invitations/PreviewPicker";
import { AdultPage, PreviewNote } from "@/components/invites/AdultPage";
import { currentAdult } from "@/lib/auth/adult";
import { invitationContext } from "@/lib/invitations/context";
import { PREVIEW_PASSAGES } from "@/lib/invitations/passages";
import { ADULTS_CONSENT, SHARE_CONSENT, contributorState, listInvitations, type InvitationDelivery } from "@/lib/invitations/server";
import { familyPage } from "@/lib/family/page-data";
import { isParent } from "@/lib/family/storyteller";
import { findCatalogBook } from "@/lib/library/catalog";

export const metadata: Metadata = { title: "Share your voice with your family | Readli Voice", robots: { index: false } };
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

/** Featured first: short, well-loved stories. The first is the recommended one. */
const FEATURED = ["winnie-the-pooh", "the-tale-of-peter-rabbit", "the-velveteen-rabbit"];

const DELIVERY: Record<InvitationDelivery, { label: string; tone: string }> = {
  sending: { label: "Sending", tone: "bg-ink/10" },
  sent: { label: "Sent", tone: "bg-mint" },
  delivered: { label: "Delivered", tone: "bg-mint" },
  bounced: { label: "Didn't arrive", tone: "bg-coral/40" },
  failed: { label: "Not sent", tone: "bg-coral/40" },
};

/**
 * Readli Voice: share your voice with your family, in three steps kept in the URL so refreshing or
 * signing in again lands in the same place. ?step=story picks and approves the preview (first, when
 * there's no approved one); ?step=send is the invitation form (the default once a preview is
 * approved); ?step=sent confirms what went out, with each email's delivery.
 */
export default async function InviteFamilyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const ctx = invitationContext();
  const header = (myVoice: string, title = "Share Your Voice With Your Family") => (
    <header className="flex flex-col gap-2">
      <Link href={myVoice} className="w-fit font-display font-semibold underline-offset-4 hover:underline">
        ← My Voice
      </Link>
      <h1 className="font-display text-3xl font-semibold sm:text-5xl">{title}</h1>
    </header>
  );
  if (!ctx) {
    return (
      <AdultPage wide>
        {header("/voice")}
        <PreviewNote>Family invitations need Readli accounts, which aren&apos;t switched on here. See how it will look at /design/invitations.</PreviewNote>
      </AdultPage>
    );
  }
  const user = await currentAdult();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/voice/invite${typeof p.step === "string" ? `?step=${p.step}` : ""}`)}`);
  const page = await familyPage();
  const myVoice = page.enabled && page.state && isParent(page.state, user.id) ? "/family/my-voice" : "/voice";
  const state = await contributorState(ctx.db, ctx.deps, user);
  if (state.blocker) {
    return (
      <AdultPage wide>
        {header(myVoice)}
        <section className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] bg-sunshine/50 p-6" data-testid="invite-blocker">
          <p className="text-lg">{BLOCKERS[state.blocker]}</p>
          {state.blocker === "no_voice" && (
            <Link href="/voice/record" className={buttonPrimary}>
              Record my voice
            </Link>
          )}
        </section>
      </AdultPage>
    );
  }
  const books = pickerBooks();
  const step = !state.approved || p.step === "story" ? "story" : p.step === "sent" ? "sent" : "send";

  if (step === "story") {
    return (
      <AdultPage wide>
        {header(myVoice)}
        <PreviewPicker books={books} featured={FEATURED} approved={state.approved} draft={state.draft} sendHref="/voice/invite?step=send" />
      </AdultPage>
    );
  }

  const approvedBook = books.find((b) => b.slug === state.approved!.book);
  if (step === "sent") {
    const since = Date.now() - 30 * 60_000;
    const recent = (await listInvitations(ctx.db, ctx.secret, user.id, state.settings)).filter((i) => Date.parse(i.lastSentAt) >= since);
    const skipped = Number(p.skipped) || 0;
    return (
      <AdultPage>
        <section className="flex max-w-xl flex-col items-center gap-4 text-center" data-testid="invite-sent" aria-live="polite">
          <ReadiMascot size={110} decorative />
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{recent.length === 1 ? "Your invitation is on its way" : "Your invitations are on their way"}</h1>
          {approvedBook && <p className="text-lg">They&apos;ll hear {approvedBook.title} read in your voice.</p>}
          <ul className="flex w-full flex-col gap-2 text-left">
            {recent.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 ring-2 ring-ink/10" data-testid="sent-row">
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{i.name || i.email}</span>
                  {i.name && <span className="truncate text-sm text-muted">{i.email}</span>}
                </span>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${DELIVERY[i.delivery].tone}`}>{DELIVERY[i.delivery].label}</span>
              </li>
            ))}
          </ul>
          {skipped > 0 && (
            <p className="text-sm">
              {skipped === 1 ? "One person wasn't invited" : `${skipped} people weren't invited`}: they&apos;d already been invited, asked not to get invitations, or today&apos;s limit was reached.
            </p>
          )}
          <p className="text-sm text-muted">My Voice shows when each family opens it and when they connect.</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto">
            <Link href={myVoice} className={buttonPrimary}>
              Go to My Voice
            </Link>
            <Link href="/voice/invite?step=send" className={buttonSecondary}>
              Invite Another Family
            </Link>
          </div>
        </section>
      </AdultPage>
    );
  }

  const sendingOff = !state.settings.sendingEnabled || !ctx.mailer;
  return (
    <AdultPage wide>
      {header(myVoice, "Who should hear it?")}
      <InviteComposer
        maxPerSend={state.settings.maxRecipientsPerSend}
        linkDays={state.settings.linkDays}
        shareConsent={SHARE_CONSENT}
        adultsConsent={ADULTS_CONSENT}
        disabled={sendingOff ? "Sending invitations switches on soon. Your approved preview is saved." : null}
        preview={approvedBook ? { id: state.approved!.id, title: approvedBook.title, coverUrl: approvedBook.coverUrl } : null}
        changeHref="/voice/invite?step=story"
        sentHref="/voice/invite?step=sent"
      />
    </AdultPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { GiftBoxArt } from "@/components/invites/illustrations";
import { JoinGiftButton } from "@/components/sponsorship/JoinGiftButton";
import { currentAdult } from "@/lib/auth/adult";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { shortDate } from "@/lib/sponsorship/rules";
import { invitationLanding } from "@/lib/sponsorship/view";

export const metadata: Metadata = { title: "A Readli gift for your family | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

const NOT_OPEN: Record<string, string> = {
  joined: "Your family has already added this gift.",
  expired: "This gift link has expired. Ask the person who sent it to send a new one.",
  invalid: "This gift link isn't valid any more. Ask the person who sent it to send a new one.",
  not_ready: "This gift isn't ready to open yet.",
};

/** A family's landing page for a sponsored gift. Their parents accept it into their own family. */
export default async function JoinGiftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await sponsorshipContext();
  const gift = ctx ? await invitationLanding(ctx.db, token) : null;
  if (!gift) {
    return (
      <AdultPage>
        <section role="alert" className="rounded-[var(--radius-panel)] bg-coral/20 p-6 text-center">
          <h1 className="font-display text-3xl font-semibold">We couldn&apos;t find that gift</h1>
          <p>Check the link in your gift email and try again.</p>
        </section>
      </AdultPage>
    );
  }
  const from = gift.giverName;
  const signedIn = Boolean(await currentAdult());
  const here = `/gift/join/${token}`;
  return (
    <AdultPage>
      <section className="flex flex-col items-center gap-4 text-center">
        <GiftBoxArt className="w-28" open />
        <Eyebrow>A gift for {gift.recipientName}</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">{from} gave your family Readli</h1>
        {gift.message && <blockquote className="max-w-lg text-lg italic">&ldquo;{gift.message}&rdquo;</blockquote>}
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
          <p className="font-semibold">{gift.sharesVoice ? `${from}'s voice, plus one more` : "One family storyteller"}</p>
          <p className="text-sm">{gift.sharesVoice ? `You approve ${from} for each child yourself.` : "Add the storyteller your family chooses."}</p>
        </li>
        <li className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
          <p className="font-semibold">Up to 6 children</p>
          <p className="text-sm">Each with their own shelf and progress.</p>
        </li>
        <li className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
          <p className="font-semibold">{gift.creditShare} story credits a month</p>
          <p className="text-sm">Your share of {from}&apos;s 40; replays are free.</p>
        </li>
        <li className="rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
          <p className="font-semibold">2 children listening at once</p>
          <p className="text-sm">Kids Mode with your own PIN.</p>
        </li>
      </ul>

      <section className="flex flex-col items-center gap-3 text-center">
        {gift.status !== "ready" ? (
          <p role="status" className="rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/10">
            {NOT_OPEN[gift.status]}
          </p>
        ) : signedIn ? (
          <JoinGiftButton token={token} />
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/login?next=${encodeURIComponent(here)}`} className={buttonPrimary}>
              Sign in to accept
            </Link>
            <Link href="/signup/family" className={buttonSecondary}>
              New to Readli? Start your family
            </Link>
            <p className="w-full text-sm text-muted">Once your family is set up, open this link again to accept.</p>
          </div>
        )}
        <p className="max-w-lg text-sm">
          You and your partner run your family&apos;s Readli. {from} pays for it but doesn&apos;t see or manage your children.
        </p>
      </section>

      <section className="rounded-3xl bg-ivory p-5 text-sm">
        <p className="font-semibold">If the gift ever ends</p>
        <p>
          We&apos;ll tell you before it does{gift.endsAt ? ` (it runs until ${shortDate(new Date(Date.parse(gift.endsAt) - 86_400_000))})` : ""}. Your children&apos;s profiles, approvals and progress are kept.
          Listening pauses until you choose a plan of your own. Stories in {from}&apos;s voice stay with your family as long as {from} keeps sharing their voice with you.
        </p>
      </section>
    </AdultPage>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonSecondary } from "@/components/brand/buttons";
import { OpenedBeacon } from "@/components/invitations/OpenedBeacon";
import { PlayButton } from "@/components/invitations/PlayButton";
import { TrialOffer } from "@/components/invitations/TrialOffer";
import { AdultPage } from "@/components/invites/AdultPage";
import { paymentsOn } from "@/lib/billing/config";
import { annualSavingsPercent, pricing } from "@/lib/content/pricing";
import { formatPrice } from "@/lib/family/plan";
import { invitationContext } from "@/lib/invitations/context";
import { DEFAULT_CONTRIBUTOR_MESSAGE } from "@/lib/invitations/invitations";
import { landingFor } from "@/lib/invitations/server";

export const metadata: Metadata = { title: "A story for your family | Readli", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** Where an invitation email lands: hear the contributor's approved preview with no account, then start a trial or connect. */
export default async function InvitationPreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = invitationContext();
  if (!ctx) notFound();
  const landing = await landingFor(ctx.db, ctx.secret, token);
  if (!landing) notFound();
  const name = landing.contributorName;
  const respond = (action: string) => `/v/respond/${landing.respondToken}?action=${action}`;

  if (landing.status !== "pending" && landing.status !== "opened") {
    const text = {
      accepted: `${name} is already part of your Family Circle.`,
      expired: `This invitation has expired. Ask ${name} to send a new one.`,
      declined: "You declined this invitation, so nothing more will happen.",
      revoked: `${name} withdrew this invitation.`,
    }[landing.status];
    return (
      <AdultPage>
        <section className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] bg-sky/40 p-8" data-testid="invitation-closed">
          <h1 className="font-display text-3xl font-semibold">{text}</h1>
          <Link href={landing.status === "accepted" ? "/family" : "/"} className={buttonSecondary}>
            {landing.status === "accepted" ? "Go to your family" : "Visit Readli"}
          </Link>
        </section>
      </AdultPage>
    );
  }

  const P = await pricing();
  const open = paymentsOn();
  return (
    <AdultPage wide>
      <OpenedBeacon token={token} />
      <section className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-sky/40 p-6 sm:p-10" data-testid="invitation-preview">
        {landing.recipientName && <p className="font-display text-lg font-semibold text-coral-deep">An invitation for {landing.recipientName}</p>}
        <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
          {landing.hasPreview ? `${name} recorded a story for your family` : `${name} wants to read stories to your family`}
        </h1>
        <blockquote className="whitespace-pre-line rounded-2xl bg-surface/80 px-5 py-4 text-lg italic">&ldquo;{landing.message || DEFAULT_CONTRIBUTOR_MESSAGE}&rdquo;</blockquote>
        {landing.hasPreview && landing.book ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {landing.book.coverUrl && <Image src={landing.book.coverUrl} alt={`Cover of ${landing.book.title}`} width={120} height={160} className="w-28 shrink-0 rounded-2xl shadow-md" />}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="font-display text-xl font-semibold">{landing.book.title}</p>
              <PlayButton label={`${name} reads ${landing.book.title}`} endpoint="/api/invitations/play" body={{ token }} testId="play-preview" />
            </div>
          </div>
        ) : null}
        {landing.hasPreview && <p className="text-sm">{name} chose this passage to share. It was read with their Readli voice; their original recordings stay private.</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-semibold">What is Readli?</h2>
        <p className="max-w-3xl text-lg">
          Readli turns classic children&apos;s books into read-alongs in the voices of the people your kids love. Grandparents, aunts and uncles record their voice once, for free. Parents decide which
          storytellers each child can hear.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <TrialOffer
          name={name}
          trialDays={P.trialDays}
          trialCredits={P.trialCredits}
          maxChildren={P.maxChildProfiles}
          monthly={formatPrice(P.familyMonthlyCents)}
          annual={formatPrice(P.familyAnnualCents)}
          savingsPercent={annualSavingsPercent(P)}
          renewsOn={longDate(new Date(Date.now() + P.trialDays * 86_400_000))}
          startHref={open ? `/v/${token}/start` : null}
        />
        <aside className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-mint/50 p-6" aria-labelledby="have-h">
            <h2 id="have-h" className="font-display text-2xl font-semibold">
              Already have Readli Family?
            </h2>
            <p>Sign in and connect {name}&apos;s voice to your family. No new account, no extra charge to connect.</p>
            <Link href={`/v/${token}/connect`} className={`${buttonSecondary} w-fit`} data-testid="connect-existing">
              Connect {name}&apos;s voice
            </Link>
          </section>
          <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10" aria-labelledby="how-h">
            <h2 id="how-h" className="font-display text-xl font-semibold">
              How it works
            </h2>
            <ol className="flex list-decimal flex-col gap-1 pl-5">
              <li>Start your trial or sign in.</li>
              <li>{name} appears in your Family Circle, waiting for your OK.</li>
              <li>You choose which children can hear {name}.</li>
            </ol>
            <p className="text-sm text-muted">Readli Voice is free for {name}, and their voice is always theirs. They can stop sharing it at any time.</p>
          </section>
        </aside>
      </div>
      <p className="text-center text-sm text-muted">
        Not for you?{" "}
        <Link href={respond("decline")} className="underline">
          Decline this invitation
        </Link>{" "}
        ·{" "}
        <Link href={respond("unsubscribe")} className="underline">
          Stop all Readli invitations
        </Link>{" "}
        ·{" "}
        <Link href={respond("report")} className="underline">
          Report it
        </Link>
      </p>
    </AdultPage>
  );
}

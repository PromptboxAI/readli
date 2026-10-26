import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { FamilyOffer } from "@/components/invitations/FamilyOffer";
import { OpenedBeacon } from "@/components/invitations/OpenedBeacon";
import { RecipientLink, RecipientPlay } from "@/components/invitations/RecipientPlay";
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

/**
 * Where an invitation email lands. The contributor's approved preview is the centerpiece and plays
 * with no account; then two paths: start Readli Family, or connect the storyteller to a family that
 * already has it. Both go through /start, which remembers the invitation through sign-in and checkout.
 */
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
  const book = landing.hasPreview ? landing.book : null;
  const start = `/v/${token}/start`;
  return (
    <AdultPage wide>
      <OpenedBeacon token={token} />
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-[var(--radius-panel)] bg-sky/40 p-5 sm:p-10" data-testid="invitation-preview">
        {landing.recipientName && <p className="font-display text-lg font-semibold text-coral-deep">An invitation for {landing.recipientName}</p>}
        <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{book ? `${name} has a bedtime story for your family.` : `${name} would love to read bedtime stories to your family.`}</h1>
        <blockquote className="whitespace-pre-line rounded-2xl bg-surface/80 px-5 py-4 text-lg italic">&ldquo;{landing.message || DEFAULT_CONTRIBUTOR_MESSAGE}&rdquo;</blockquote>
        {book && (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center" data-testid="preview-centerpiece">
            {book.coverUrl && <Image src={book.coverUrl} alt={`${book.title} book cover`} width={180} height={240} priority className="w-36 shrink-0 rounded-2xl shadow-md sm:w-40" />}
            <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
              <p className="text-center font-display text-xl font-semibold sm:text-left">Hear {name}&apos;s voice reading {book.title}.</p>
              <RecipientPlay token={token} label={`Hear ${name} read ${book.title}`} />
              <p className="text-sm">
                Read with {name}&apos;s Readli voice. Their original recordings stay private.{" "}
                <Link href="/privacy" className="underline underline-offset-4">
                  How Readli protects voices
                </Link>
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="mx-auto grid w-full max-w-4xl gap-5 md:grid-cols-2">
        <FamilyOffer
          token={token}
          name={name}
          monthly={formatPrice(P.familyMonthlyCents)}
          annual={formatPrice(P.familyAnnualCents)}
          monthlyCredits={P.monthlyCredits}
          savingsPercent={annualSavingsPercent(P)}
          startHref={paymentsOn() ? start : null}
          laterHref={start}
        />
        <section className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-panel)] bg-mint/50 p-5 sm:p-6" aria-labelledby="have-h">
          <h2 id="have-h" className="font-display text-2xl font-semibold">
            Already have Readli Family?
          </h2>
          <p>Sign in and add {name} to your family. Connecting is free.</p>
          <RecipientLink token={token} event="connect_cta" href={start} className={`${buttonPrimary} w-full`} testId="connect-existing">
            Connect {name} to My Family
          </RecipientLink>
        </section>
      </div>

      <section className="mx-auto flex w-full max-w-2xl flex-col gap-3" aria-labelledby="how-h">
        <h2 id="how-h" className="font-display text-xl font-semibold">
          How it works
        </h2>
        <p>Readli reads classic children&apos;s books aloud in the voices of the people your children love. You decide who each child hears.</p>
        <ol className="flex list-decimal flex-col gap-1 pl-5" data-testid="how-it-works">
          <li>Start Readli Family, or sign in.</li>
          <li>Add {name} as a storyteller.</li>
          <li>Choose which children can listen, then pick a story.</li>
        </ol>
      </section>

      <footer className="mx-auto flex max-w-2xl flex-col gap-1 text-center text-sm text-muted">
        <p>This invitation expires on {longDate(new Date(landing.expiresAt))}.</p>
        <p>
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
      </footer>
    </AdultPage>
  );
}

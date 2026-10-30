import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { ReplyForm } from "@/components/donations/ReplyForm";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { effectivePlan } from "@/lib/billing/price-settings";
import { SUPPORT_EMAIL } from "@/lib/donations/emails";
import { eventDateLabel, money, STATUS_LABELS } from "@/lib/donations/program";
import { applicantView } from "@/lib/donations/server";
import { accountDb } from "@/lib/family/account-store";
import { claimByLabel } from "@/lib/gifting/complimentary-copy";
import { PRIVATE_ROBOTS } from "@/lib/seo/site";

export const metadata: Metadata = { title: "Your Readli Gives Back request | Readli", robots: PRIVATE_ROBOTS, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const TONE = { pending: "bg-sky/40", needs_info: "bg-sunshine/50", approved: "bg-mint/50", rejected: "bg-ink/10" } as const;

/** The applicant's private request page, reached only from the link in their emails. */
export default async function DonationStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = accountDb();
  if (!db) {
    return (
      <AdultPage>
        <PreviewNote>Request pages show here once Supabase is connected.</PreviewNote>
      </AdultPage>
    );
  }
  const view = await applicantView(db, token);
  if (!view) notFound();
  const retail = money((await effectivePlan(db)).familyAnnualPriceCents);
  const files = `/api/donations/status/${encodeURIComponent(token)}`;

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>Readli Gives Back</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">{view.eventName}</h1>
        <p className="text-lg">
          {view.orgName} · {eventDateLabel(view.eventDate)} · Reference {view.reference}
        </p>
        <p className={`w-fit rounded-full px-4 py-1.5 font-semibold ${TONE[view.status]}`} data-testid="donation-status">
          {STATUS_LABELS[view.status]}
        </p>
      </header>

      {view.status === "pending" && (
        <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-sky/25 p-5 sm:p-7">
          <h2 className="font-display text-2xl font-semibold">We&apos;re reviewing your request</h2>
          <p>{view.replied ? "Thanks for your reply. Our team is taking another look." : "Thanks for applying. We'll email you as soon as our eligibility review is complete."}</p>
        </section>
      )}

      {view.status === "needs_info" && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sunshine/30 p-5 sm:p-7">
          <h2 className="font-display text-2xl font-semibold">We need a little more information</h2>
          {view.infoRequest && <p className="whitespace-pre-line rounded-2xl bg-surface p-4 text-lg">{view.infoRequest}</p>}
          <ReplyForm token={token} />
        </section>
      )}

      {view.status === "rejected" && (
        <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-ink/5 p-5 sm:p-7">
          <h2 className="font-display text-2xl font-semibold">We weren&apos;t able to approve this request</h2>
          {view.decisionReason && <p className="whitespace-pre-line">{view.decisionReason}</p>}
          <p>
            If something has changed, email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline underline-offset-4">{SUPPORT_EMAIL}</a> with your reference
            number and we&apos;ll take another look.
          </p>
        </section>
      )}

      {view.status === "approved" && view.certificate && (
        <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]" aria-labelledby="cert-h">
          <div className="flex flex-col gap-4">
            <h2 id="cert-h" className="font-display text-3xl font-semibold">
              Your donation certificate is ready
            </h2>
            <p className="text-lg">
              Print it at 8.5 × 11 in for your raffle basket or auction table. The winning family scans the QR code or visits readli.ai/redeem to activate a year of Readli
              Family, with no credit card.
            </p>
            {view.certificate.redeemed ? (
              <p className="rounded-2xl bg-mint/50 p-4 font-semibold">The winning family has activated their membership. Thank you for including Readli in your event!</p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <a href={`${files}/certificate.pdf`} className={buttonPrimary} download>
                  Download certificate (PDF)
                </a>
                <a href={`${files}/qr-code.png`} className={buttonSecondary} download>
                  QR code (PNG)
                </a>
              </div>
            )}
            <p className="text-sm text-muted">
              Keep the certificate safe until the event: anyone with its code can redeem it. If it&apos;s lost or shared by mistake, email {SUPPORT_EMAIL} and we&apos;ll
              replace it with a new code.
            </p>
          </div>
          <div
            className="flex flex-col items-center gap-2 rounded-[28px] border-4 border-ink bg-ivory px-6 py-8 text-center"
            aria-label="Certificate preview"
            data-testid="certificate-preview"
          >
            <p className="text-sm font-extrabold tracking-[0.16em] text-plum uppercase">Readli Gives Back</p>
            <p className="font-display text-3xl font-semibold">A Whole Year of Stories Awaits!</p>
            <p className="text-lg">You&apos;ve won a Readli Family Annual Membership!</p>
            <p className="font-semibold text-plum">Donated by Readli.ai · Proudly supporting {view.certificate.supportingName}</p>
            <div className="my-3 grid size-36 place-items-center rounded-2xl bg-surface ring-2 ring-ink/40">
              <span className="px-3 text-sm text-muted">QR code and redemption code on the printed certificate</span>
            </div>
            <p className="font-semibold">12-Month Family Membership · Retail-equivalent value {retail}</p>
            <p>Activate at readli.ai/redeem by {claimByLabel(view.certificate.claimBy)}</p>
            <p className="font-display font-semibold text-plum">Every Book. Every Voice.</p>
          </div>
        </section>
      )}

      <p className="text-sm text-muted">
        Questions? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4">{SUPPORT_EMAIL}</a> with reference {view.reference}.{" "}
        <Link href="/donations" className="underline underline-offset-4">
          About Readli Gives Back
        </Link>
      </p>
    </AdultPage>
  );
}

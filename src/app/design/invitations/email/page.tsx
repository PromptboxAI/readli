import type { Metadata } from "next";
import Image from "next/image";
import { pricing } from "@/lib/content/pricing";
import { formatPrice } from "@/lib/family/plan";
import { DesignFrame } from "../DesignFrame";

export const metadata: Metadata = { title: "Design: Invitation email | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The Readli-branded invitation email, shown inside a mail app frame. */
export default async function InvitationEmailDesign() {
  const P = await pricing();
  return (
    <DesignFrame current="/design/invitations/email" chrome={false}>
      <main className="min-h-screen bg-ink/5 px-3 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto flex max-w-2xl flex-col overflow-hidden rounded-3xl bg-surface shadow-lg ring-1 ring-ink/10" data-testid="invite-email">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-ink/10 px-5 py-4 text-sm">
            <dt className="text-muted">From</dt>
            <dd>June Walker via Readli &lt;invites@readli.ai&gt;</dd>
            <dt className="text-muted">To</dt>
            <dd>sara@example.com</dd>
            <dt className="text-muted">Subject</dt>
            <dd className="font-semibold">June recorded her voice to read your family bedtime stories</dd>
          </dl>

          <div className="flex flex-col gap-6 bg-ivory px-6 py-8 sm:px-10">
            <div className="flex items-center gap-2">
              <Image src="/brand/readi-icon.webp" alt="" width={44} height={30} />
              <span className="font-display text-2xl font-semibold">Readli</span>
            </div>
            <h1 className="font-display text-3xl font-semibold leading-tight">Hi Sara, June has a story for you.</h1>
            <p className="text-lg">
              June recorded her voice with Readli so she can read bedtime stories to your family, even from far away. She&apos;d love for you to hear it.
            </p>
            <blockquote className="rounded-2xl border-l-4 border-coral-deep bg-surface px-5 py-4 text-lg italic">
              &ldquo;I recorded my voice so I can read the kids their bedtime stories, even from far away. Love, Mom&rdquo;
            </blockquote>
            <a href="/design/invitations/preview" className="inline-flex min-h-12 w-fit items-center rounded-full bg-coral-deep px-7 font-display text-lg font-semibold text-white">
              Hear June&apos;s voice
            </a>
            <p>
              It takes a few seconds. No account or payment needed to listen. If you&apos;d like June to read to your children every night, you can try
              Readli Family free for {P.trialDays} days, then {formatPrice(P.familyMonthlyCents)} a month or {formatPrice(P.familyAnnualCents)} a year.
            </p>
            <p className="text-sm text-muted">This link is just for you and expires on October 24.</p>
          </div>

          <footer className="flex flex-col gap-2 border-t border-ink/10 px-6 py-5 text-sm text-muted sm:px-10">
            <p>You&apos;re getting this because June Walker, a verified Readli Voice member, invited you by name. Readli never sends emails from anyone&apos;s contact list.</p>
            <p>
              <a href="#" className="underline">
                No thanks, decline
              </a>{" "}
              ·{" "}
              <a href="#" className="underline">
                Don&apos;t email me about Readli again
              </a>{" "}
              ·{" "}
              <a href="#" className="underline">
                Report this email
              </a>
            </p>
            <p>Readli · readli.ai</p>
          </footer>
        </div>
      </main>
    </DesignFrame>
  );
}

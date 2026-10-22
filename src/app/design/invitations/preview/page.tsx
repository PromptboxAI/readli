import type { Metadata } from "next";
import { buttonSecondary } from "@/components/brand/buttons";
import { annualSavingsPercent, pricing } from "@/lib/content/pricing";
import { formatPrice } from "@/lib/family/plan";
import { DesignFrame, renewalDate, SamplePlayer } from "../DesignFrame";
import { TrialCard } from "./TrialCard";

export const metadata: Metadata = { title: "Design: Voice preview page | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Where the invitation link lands: hear the approved sample with no account, then start a trial or connect. */
export default async function VoicePreviewDesign() {
  const P = await pricing();
  return (
    <DesignFrame current="/design/invitations/preview">
      <main className="flex flex-col">
        <section className="bg-sky/40 px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            <p className="font-display text-lg font-semibold text-coral-deep">An invitation for Sara</p>
            <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">June recorded her voice to read stories to your family</h1>
            <blockquote className="rounded-2xl bg-surface/80 px-5 py-4 text-lg italic">
              &ldquo;I recorded my voice so I can read the kids their bedtime stories, even from far away. Love, Mom&rdquo;
            </blockquote>
            <SamplePlayer label="June reads “The Three Little Pigs”" />
            <p className="text-sm">
              June chose this sample to share. It was made with her Readli voice; her original recordings stay private.
            </p>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr]">
          <TrialCard
            trialDays={P.trialDays}
            trialCredits={P.trialCredits}
            monthly={formatPrice(P.familyMonthlyCents)}
            annual={formatPrice(P.familyAnnualCents)}
            savingsPercent={annualSavingsPercent(P)}
            renewsOn={renewalDate(P.trialDays)}
          />
          <aside className="flex flex-col gap-4">
            <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-mint/50 p-6" aria-labelledby="have-h">
              <h2 id="have-h" className="font-display text-2xl font-semibold">
                Already have Readli Family?
              </h2>
              <p>Sign in and add June to your Family Circle. No new account, no extra charge to connect.</p>
              <a href="/design/invitations/accept" className={`${buttonSecondary} w-fit`}>
                Connect June&apos;s voice
              </a>
            </section>
            <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10" aria-labelledby="how-h">
              <h2 id="how-h" className="font-display text-xl font-semibold">
                How it works
              </h2>
              <ol className="flex list-decimal flex-col gap-1 pl-5">
                <li>Start your trial or sign in.</li>
                <li>June appears in your Family Circle, waiting for your OK.</li>
                <li>You choose which children can hear her.</li>
              </ol>
              <p className="text-sm text-muted">June&apos;s voice is free for her and always hers. She can stop sharing it at any time.</p>
            </section>
          </aside>
        </div>
        <p className="px-4 pb-10 text-center text-sm text-muted">
          Not for you?{" "}
          <a href="#" className="underline">
            Decline this invitation
          </a>{" "}
          ·{" "}
          <a href="#" className="underline">
            Report it
          </a>
        </p>
      </main>
    </DesignFrame>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PlanList } from "@/components/accounts/PlanList";
import { SignupReassurance } from "@/components/accounts/SignupSteps";
import { buttonSecondary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { StartFamilyPlan } from "@/components/onboarding/StartFamilyPlan";
import { StartStepper } from "@/components/onboarding/StartStepper";
import { ACCOUNT_TYPES } from "@/lib/accounts/accounts";
import { familyCheckoutOpen } from "@/lib/accounts/checkout";
import { billingConfig } from "@/lib/billing/config";
import { storiesPerMonth } from "@/lib/content/credits-explained";
import { pricing } from "@/lib/content/pricing";
import { formatPrice } from "@/lib/family/plan";
import { publicLibrary } from "@/lib/library/public";
import { startHref } from "@/lib/onboarding/start";
import { startContext } from "@/lib/onboarding/start-server";

export const metadata: Metadata = {
  title: "Choose your plan | Readli",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

const VOICE_KEEPS = ["Your voice, recorded and kept", "Share it with any family on Readli Family", "Hear a preview of your voice", "Never pay to record or share"];
const VOICE_LEAVES_OUT = ["Your own kids' profiles and bookshelves", "Preparing stories for your kids"];

/**
 * The plans, as the last step of the new-signup welcome (and for a parent whose family has no plan yet):
 * Readli Family monthly or yearly with one clear button to checkout, or the free Readli Voice account,
 * which reads to kids only in a family that has Readli Family. No credits, packs or extra slots here:
 * those are for a family that already has a plan, on Plan & credits.
 */
export default async function StartPlanPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const q = await searchParams;
  const ctx = await startContext("/start/plan", { plan: true });
  const P = await pricing();
  const stories = storiesPerMonth(P.monthlyCredits, publicLibrary(), P.charactersPerCredit);
  const paymentsOn = familyCheckoutOpen() && billingConfig().mode !== "off";
  const family = ctx.familyName;
  const includes = [
    `${P.includedNarratorSlots} family storytellers included, like you and a grandparent`,
    `${P.monthlyCredits} narration credits every month, about ${stories} new bedtime stories`,
    `Up to ${P.maxChildProfiles} kids, each with their own bookshelf in Readli Kids`,
    "Replay prepared stories as often as you like",
    "You approve who each child hears",
    "Cancel any time",
  ];
  return (
    <AdultPage wide>
      {!ctx.parent && (
        <StartStepper
          step="plan"
          done={{
            name: Boolean(ctx.name),
            family: Boolean(family),
            voice: ctx.voice !== "none",
            listen: ctx.voice !== "none",
          }}
        />
      )}
      <header className="flex flex-col gap-2">
        <Eyebrow>{family ?? "Your family"}</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">{ctx.voice !== "none" ? "Your voice is ready for bedtime" : "Choose how you'll use Readli"}</h1>
        <p className="max-w-3xl text-xl">
          Start Readli Family to have stories read to your kids in your voice and the voices of the people they love. Or keep a free account to share your voice with a family that
          already has Readli Family.
        </p>
      </header>
      {q.checkout === "canceled" && (
        <p role="status" className="rounded-2xl bg-surface p-4 ring-2 ring-ink/10">
          Checkout was canceled. Nothing was charged. Choose a plan when you&apos;re ready.
        </p>
      )}
      {!paymentsOn && (
        <p data-testid="checkout-off" className="rounded-2xl bg-sunshine/35 p-4 text-lg">
          Checkout isn&apos;t switched on yet, so nothing will be charged.
        </p>
      )}

      <div className={`grid gap-6 ${ctx.parent ? "" : "lg:grid-cols-[1.5fr_1fr]"}`}>
        <section
          aria-labelledby="plan-family"
          data-testid="start-plan-family"
          className="flex flex-col gap-5 rounded-[var(--radius-panel)] border-[3px] border-ink bg-sunshine/35 p-5 shadow-[6px_8px_0_rgba(40,53,72,0.15)] sm:p-8"
        >
          <div className="flex flex-col gap-1">
            <p className="w-fit rounded-full bg-coral-deep px-3 py-0.5 text-sm font-bold text-white">Recommended</p>
            <h2 id="plan-family" className="font-display text-3xl font-semibold">
              Readli Family
            </h2>
            <p className="text-lg">Everything your kids need to hear bedtime stories in family voices.</p>
          </div>
          <PlanList items={includes} className="text-lg" />
          <StartFamilyPlan monthlyCents={P.familyMonthlyCents} annualCents={P.familyAnnualCents} monthlyCredits={P.monthlyCredits} familyName={family} paymentsOn={paymentsOn} />
          <p className="text-muted">
            Need more storytellers, like both sets of grandparents? Add extra slots any time after you start, {formatPrice(P.extraSlotMonthlyCents)} a month each.
          </p>
        </section>

        {!ctx.parent && (
          <section
            aria-labelledby="plan-voice"
            data-testid="start-plan-voice"
            className="flex flex-col gap-5 self-start rounded-[var(--radius-panel)] bg-mint/50 p-5 ring-2 ring-ink/10 sm:p-8"
          >
            <div className="flex flex-col gap-1">
              <h2 id="plan-voice" className="font-display text-3xl font-semibold">
                {ACCOUNT_TYPES.voice.name}
              </h2>
              <p className="font-display text-2xl font-semibold">Free</p>
              <p className="text-lg">
                For reading to someone else&apos;s kids, like grandkids, nieces and nephews. Your voice reads to them once their family, on Readli Family, says yes.
              </p>
            </div>
            <PlanList items={VOICE_KEEPS} />
            <PlanList items={VOICE_LEAVES_OUT} cross />
            <Link href="/start/free" className={`${buttonSecondary} w-full`} data-testid="start-keep-free">
              Keep my free account
            </Link>
            <p className="text-sm text-muted">You can start Readli Family any time from your account.</p>
          </section>
        )}
      </div>

      <SignupReassurance />
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {!ctx.parent && (
          <Link href={startHref("listen")} className="font-semibold underline underline-offset-4">
            Back
          </Link>
        )}
        {ctx.parent && (
          <Link href="/family" className="font-semibold underline underline-offset-4">
            Not now
          </Link>
        )}
        <Link href="/gift" className="font-semibold underline underline-offset-4">
          Have a gift code?
        </Link>
      </div>
    </AdultPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FamilyStart } from "@/components/accounts/FamilyStart";
import { AccountFields } from "@/components/accounts/AccountFields";
import { PlanIncludes, SignupReassurance, StepHeading } from "@/components/accounts/SignupSteps";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { BillingChoice } from "@/components/accounts/BillingChoice";
import { effectivePlan } from "@/lib/billing/price-settings";
import { accountDb } from "@/lib/family/account-store";
import { familyCheckoutOpen } from "@/lib/accounts/checkout";
import { currentAdult } from "@/lib/auth/adult";
import { navState } from "@/lib/auth/nav-state";
import { billingConfig } from "@/lib/billing/config";
import { familyAccountsEnabled } from "@/lib/family/session";

export const metadata: Metadata = { title: "Create a Family | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FamilySignupPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string | string[]; from?: string | string[]; cleanup?: string | string[]; checkout?: string | string[] }>;
}) {
  const open = familyCheckoutOpen();
  const plan = await effectivePlan(accountDb());
  const params = await searchParams;
  const initial = params.billing === "annual" ? "annual" : "monthly";
  const fromTry = params.from === "try";
  // With accounts on, a family starts for real: choose a plan, sign in on this page, then straight to
  // checkout. Setup asks for the family's name once it's paid for.
  const accounts = familyAccountsEnabled();
  const adult = accounts ? await currentAdult() : null;
  if (adult) {
    const nav = await navState();
    // Already on Readli Family: nothing to buy here.
    if (nav.kind === "adult" && nav.family.plan !== "none") redirect("/family");
  }
  const carry = new URLSearchParams();
  if (fromTry) carry.set("from", "try");
  if (fromTry && params.cleanup === "1") carry.set("cleanup", "1");
  const canceled = params.checkout === "canceled";
  return (
    <AdultPage>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 text-lg">
        <header className="flex flex-col gap-3">
          <Link
            href={fromTry ? `/try?resume=1${params.cleanup === "1" ? "&cleanup=1" : ""}` : "/signup"}
            className="flex min-h-11 w-fit items-center font-display text-lg font-semibold underline-offset-4 hover:underline"
          >
            ← Back
          </Link>
          <Eyebrow>Readli Family</Eyebrow>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Create your family</h1>
          <p className="text-xl">Two quick steps: choose how to pay, then enter your email. It takes about a minute.</p>
          {fromTry && (
            <p className="rounded-2xl bg-mint/50 p-4" data-testid="try-carry-note">
              Your recording from the Try page comes with you. Start your family within 24 hours, then choose <strong>Use this recording</strong>{" "}
              under My voice, so you won&apos;t read the story again.
            </p>
          )}
          {canceled && (
            <p role="status" className="rounded-2xl bg-surface p-4 ring-2 ring-ink/10">
              Checkout was canceled. Nothing was charged. Choose a plan when you&apos;re ready.
            </p>
          )}
        </header>
        {!accounts && <PreviewNote>Family accounts are coming soon, so nothing here is saved or charged yet.</PreviewNote>}
        {accounts ? (
          <FamilyStart
            monthlyCents={plan.familyMonthlyPriceCents}
            annualCents={plan.familyAnnualPriceCents}
            monthlyCredits={plan.monthlyCredits}
            initial={initial}
            signedInAs={adult ? (adult.email ?? "your Readli account") : null}
            paymentsOn={open && billingConfig().mode !== "off"}
            autoStart={params.checkout === "1"}
            carry={carry.toString()}
          />
        ) : (
          <form className="flex flex-col gap-8" aria-label="Create a Readli Family account">
            <section aria-labelledby="plan" className="flex flex-col gap-6 rounded-[var(--radius-panel)] bg-sunshine/35 p-5 sm:p-8">
              <StepHeading n={1} id="plan">
                Choose how to pay
              </StepHeading>
              <BillingChoice
                monthlyCents={plan.familyMonthlyPriceCents}
                annualCents={plan.familyAnnualPriceCents}
                monthlyCredits={plan.monthlyCredits}
                initial={initial}
              />
              <PlanIncludes />
            </section>
            <section aria-labelledby="acct" className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-surface p-5 ring-[3px] ring-ink/10 sm:p-8">
              <StepHeading n={2} id="acct">
                Enter your email, then pay
              </StepHeading>
              <AccountFields askName={false} />
              {!open && (
                <p data-testid="checkout-off" className="rounded-2xl bg-sunshine/35 p-4">
                  Checkout isn&apos;t switched on yet, so nothing will be charged.
                </p>
              )}
              <button type="submit" className={`${buttonPrimary} min-h-16 w-full text-xl`} disabled={!open}>
                Start Readli Family
              </button>
            </section>
          </form>
        )}
        <SignupReassurance />
        <Link href="/gift" className="self-center font-semibold underline underline-offset-4">
          Have a gift code?
        </Link>
      </div>
    </AdultPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { AccountFields } from "@/components/accounts/AccountFields";
import { PlanList } from "@/components/accounts/PlanList";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { ACCOUNT_TYPES } from "@/lib/accounts/accounts";
import { BillingChoice } from "@/components/accounts/BillingChoice";
import { effectivePlan } from "@/lib/billing/price-settings";
import { accountDb } from "@/lib/family/account-store";
import { familyCheckoutOpen } from "@/lib/accounts/checkout";
import { currentAdult } from "@/lib/auth/adult";
import { familyAccountsEnabled } from "@/lib/family/session";
import { rewardsConfig, rewardsVisible } from "@/lib/rewards/rewards";

export const metadata: Metadata = { title: "Create a Family | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FamilySignupPage({ searchParams }: { searchParams: Promise<{ billing?: string | string[]; from?: string | string[]; cleanup?: string | string[] }> }) {
  const open = familyCheckoutOpen();
  const plan = await effectivePlan(accountDb());
  const params = await searchParams;
  const initial = params.billing === "annual" ? "annual" : "monthly";
  const fromTry = params.from === "try";
  // With accounts on, a family starts for real: sign in, name the family, then check out from Billing.
  const accounts = familyAccountsEnabled();
  const start = "/family?start=1";
  if (accounts && (await currentAdult())) redirect(start);
  const rewards = rewardsConfig();
  // The trial shows on previews for review, and in production only once the program is public.
  const showTrial = rewardsVisible(rewards);
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Link href={fromTry ? `/try?resume=1${params.cleanup === "1" ? "&cleanup=1" : ""}` : "/signup"} className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Back
        </Link>
        <Eyebrow>Readli Family</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Create your family</h1>
        {fromTry && (
          <p className="max-w-2xl rounded-2xl bg-mint/50 p-4" data-testid="try-carry-note">
            Your recording from the Try page comes with you. Start your family within 24 hours, then choose <strong>Use this recording</strong>{" "}
            under My voice, so you won&apos;t read the story again.
          </p>
        )}
      </header>
      {!accounts && <PreviewNote>Family accounts are coming soon, so nothing here is saved or charged yet.</PreviewNote>}
      {accounts ? (
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <section aria-labelledby="acct" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
            <h2 id="acct" className="font-display text-2xl font-semibold">
              1. Your account
            </h2>
            <p>Sign in with your email or Google. New here? This creates your account.</p>
            <LoginForm next={start} askMarketing />
          </section>
          <section aria-labelledby="plan" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sunshine/50 p-6 sm:p-8">
            <h2 id="plan" className="font-display text-2xl font-semibold">
              2. Name your family, then choose your plan
            </h2>
            <p>
              Monthly or yearly, chosen at checkout after you name your family. You can add your children&apos;s profiles at no extra
              charge.
            </p>
            <PlanList items={ACCOUNT_TYPES.family.includes} />
          </section>
        </div>
      ) : (
        <form className="grid gap-8 lg:grid-cols-[1.1fr_1fr]" aria-label="Create a Readli Family account">
          <section aria-labelledby="acct" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
            <h2 id="acct" className="font-display text-2xl font-semibold">
              1. Your account
            </h2>
            <AccountFields askName={false} />
            <p className="text-sm text-muted">After checkout you&apos;ll add your name and your children&apos;s profiles. There&apos;s no charge per child.</p>
          </section>

          <section aria-labelledby="checkout" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sunshine/50 p-6 sm:p-8">
            <h2 id="checkout" className="font-display text-2xl font-semibold">
              2. Your plan
            </h2>
            <BillingChoice
              monthlyCents={plan.familyMonthlyPriceCents}
              annualCents={plan.familyAnnualPriceCents}
              monthlyCredits={plan.monthlyCredits}
              initial={initial}
            />
            {showTrial && (
              <div className="flex flex-col gap-1 rounded-2xl bg-mint/60 p-4" data-testid="family-trial">
                <p className="font-display text-lg font-semibold">Try it free for {rewards.trialDays} days</p>
                <p className="text-sm">
                  For new families. Your trial includes {rewards.trialCredits} narration credits for new stories in your storytellers&apos; voices.
                </p>
                {!rewards.programPublic && <p className="text-sm text-muted">Not switched on yet. This is how it will look.</p>}
              </div>
            )}
            <PlanList items={ACCOUNT_TYPES.family.includes} />
            {!open && (
              <p data-testid="checkout-off" className="rounded-2xl bg-surface/80 p-3 text-sm">
                Checkout isn&apos;t switched on yet, so nothing will be charged.
              </p>
            )}
            <button type="submit" className={`${buttonPrimary} w-full`} disabled={!open}>
              Start Readli Family
            </button>
            <Link href="/gift" className="text-center font-semibold underline underline-offset-4">
              Have a gift code?
            </Link>
          </section>
        </form>
      )}
    </AdultPage>
  );
}

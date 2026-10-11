import type { Metadata } from "next";
import Link from "next/link";
import { AccountFields } from "@/components/accounts/AccountFields";
import { PlanList } from "@/components/accounts/PlanList";
import { buttonPrimary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { ACCOUNT_TYPES } from "@/lib/accounts/accounts";
import { DEFAULT_PLAN, formatPrice } from "@/lib/family/plan";
import { familyCheckoutOpen } from "@/lib/accounts/checkout";
import { rewardsConfig, rewardsVisible } from "@/lib/rewards/rewards";

export const metadata: Metadata = { title: "Create a Family | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function FamilySignupPage() {
  const open = familyCheckoutOpen();
  const price = formatPrice(DEFAULT_PLAN.familyMonthlyPriceCents);
  const rewards = rewardsConfig();
  // The trial shows on previews for review, and in production only once the program is public.
  const showTrial = rewardsVisible(rewards);
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Link href="/signup" className="w-fit font-display font-semibold underline-offset-4 hover:underline">
          ← Back
        </Link>
        <Eyebrow>Readli Family</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Create your family</h1>
      </header>
      <PreviewNote>Family accounts are coming soon, so nothing here is saved or charged yet.</PreviewNote>
      <form className="grid gap-8 lg:grid-cols-[1.1fr_1fr]" aria-label="Create a Readli Family account">
        <section aria-labelledby="acct" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
          <h2 id="acct" className="font-display text-2xl font-semibold">
            1. Your account
          </h2>
          <AccountFields />
          <p className="text-sm text-muted">You&apos;ll add your children&apos;s profiles after checkout. There&apos;s no charge per child.</p>
        </section>

        <section aria-labelledby="checkout" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sunshine/50 p-6 sm:p-8">
          <h2 id="checkout" className="font-display text-2xl font-semibold">
            2. Your plan
          </h2>
          <div className="flex items-baseline justify-between gap-4 rounded-2xl bg-surface p-4">
            <span className="font-display text-xl font-semibold">Readli Family</span>
            <span className="font-display text-xl" data-testid="family-price">
              {price}
              <span className="text-base text-muted">/month</span>
            </span>
          </div>
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
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 border-t-2 border-ink/10 pt-3">
            <dt>Monthly total</dt>
            <dd className="font-semibold">{price}</dd>
            <dt className="text-sm text-muted">Renews monthly. Cancel any time.</dt>
            <dd />
          </dl>
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
    </AdultPage>
  );
}

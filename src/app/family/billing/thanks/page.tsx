import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";
import { CheckoutDone } from "@/components/family/BillingActions";
import { FamilyOff, FamilyShell, NeedsGrownUp } from "@/components/family/FamilyShell";
import { GoToFamily } from "@/components/family/GoToFamily";
import { PlanStarting } from "@/components/family/PlanStarting";
import { billingConfig } from "@/lib/billing/config";
import { confirmCheckout, type CheckoutOutcome } from "@/lib/billing/confirm";
import { StripeApi } from "@/lib/billing/stripe-api";
import { accountDb } from "@/lib/family/account-store";
import { familyPage } from "@/lib/family/page-data";
import { guardianHousehold } from "@/lib/family/service";
import { familyStore } from "@/lib/family/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thank you | Readli", robots: { index: false } };

function what(outcome: Extract<CheckoutOutcome, { status: "done" }>): string {
  if (outcome.item.startsWith("credit_pack:")) return outcome.credits ? `${outcome.credits} narration credits are in your family's account.` : "Your narration credits are in your family's account.";
  if (outcome.item === "family_annual") return "Readli Family is on for the year.";
  return "Readli Family is on.";
}

/** Where Stripe Checkout lands: confirms the purchase, says thank you, then moves on to the family home. */
export default async function CheckoutThanksPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId = "" } = await searchParams;
  const page = await familyPage();
  if (!page.enabled) return <FamilyOff />;
  if (page.session?.actor.kind !== "adult") return <NeedsGrownUp text="Only a parent or guardian can see your family's plan and billing." />;
  const store = (await familyStore(page.session))!;
  const householdId = await guardianHousehold(store, page.session.actor);
  const config = billingConfig();
  const db = accountDb();
  let outcome: CheckoutOutcome = { status: "pending" };
  if (householdId && db && config.mode !== "off") {
    const stripe = new StripeApi(config);
    outcome = await confirmCheckout(db, (id) => stripe.getCheckoutSession(id), sessionId, householdId).catch((err: unknown) => {
      console.error("confirm checkout failed", err);
      return { status: "pending" } as const;
    });
  }
  const safeId = /^cs_[A-Za-z0-9_]+$/.test(sessionId) ? sessionId : undefined;

  return (
    <FamilyShell>
      <CheckoutDone sessionId={safeId} />
      {outcome.status === "done" ? (
        <section className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] bg-surface p-8 ring-2 ring-ink/10" data-testid="checkout-thanks">
          <h1 className="font-display text-4xl font-semibold">Thank you!</h1>
          <p className="text-lg">{what(outcome)} Taking you to your family now.</p>
          <Link href="/family" className={buttonPrimary}>
            Go to my family
          </Link>
          <GoToFamily />
        </section>
      ) : outcome.status === "pending" ? (
        <section className="flex flex-col gap-4">
          <h1 className="font-display text-4xl font-semibold">Thank you!</h1>
          <PlanStarting waiting="We're confirming your payment with Stripe. This page updates on its own in a few seconds." />
        </section>
      ) : (
        <section className="flex flex-col items-start gap-4">
          <h1 className="font-display text-4xl font-semibold">We couldn&apos;t find that checkout</h1>
          <Link href="/family/billing" className="font-semibold underline underline-offset-4">
            See your plan and billing
          </Link>
        </section>
      )}
    </FamilyShell>
  );
}

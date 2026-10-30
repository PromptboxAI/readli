"use client";

import { useEffect, useRef, useState } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { BillingChoice, type Billing } from "@/components/accounts/BillingChoice";
import { buttonPrimary } from "@/components/brand/buttons";
import { PlanIncludes, StepHeading } from "@/components/accounts/SignupSteps";
import { newMetaEventId, rememberCheckout, trackMeta } from "@/lib/marketing/meta-pixel";

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & Record<string, unknown>;
  if (!res.ok) throw new Error(json.error?.message ?? "Checkout couldn't start. Please try again.");
  return json;
}

/**
 * Family signup: choose monthly or yearly with the real price, sign in with the emailed code on this
 * page (or carry on, already signed in), then straight to that plan's Stripe checkout. The family is
 * started with a stand-in name so checkout has a household to bill; setup asks for the name once paid.
 * Someone who already has a free Readli Voice account signs in as themselves, so the family is theirs
 * and their voice and its permissions stay as they are.
 */
export function FamilyStart(props: {
  monthlyCents: number;
  annualCents: number;
  monthlyCredits: number;
  initial: Billing;
  /** Signed in already (a Readli Voice account, or back from Google). */
  signedInAs: string | null;
  paymentsOn: boolean;
  /** Back from Google or the email link with this plan chosen: go on to checkout without another click. */
  autoStart: boolean;
  /** Query to keep on the way back here, such as from=try. */
  carry: string;
}) {
  const [billing, setBilling] = useState<Billing>(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const checkout = async () => {
    // Before payments are on, there's nothing to buy: the family still starts, and Plan and billing says why.
    if (!props.paymentsOn) {
      window.location.assign("/family?start=1");
      return;
    }
    await post("/api/family/household", { provisional: true });
    const item = billing === "annual" ? "family_annual" : "family_monthly";
    const cents = billing === "annual" ? props.annualCents : props.monthlyCents;
    // The server reports the same checkout with this id once Stripe's session exists.
    const eventId = newMetaEventId();
    trackMeta("InitiateCheckout", { value: cents / 100, currency: "USD", content_name: item }, eventId);
    rememberCheckout(cents);
    const { url } = await post("/api/billing/checkout", { item, from: "signup", ...(eventId ? { metaEventId: eventId } : {}) });
    if (typeof url !== "string") throw new Error("Checkout couldn't start. Please try again.");
    window.location.assign(url);
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await checkout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout couldn't start. Please try again.");
      setBusy(false);
    }
  };

  useEffect(() => {
    if (props.autoStart && props.signedInAs && !started.current) {
      started.current = true;
      void run();
    }
    // Runs once on arrival; run() reads the plan chosen before signing in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = new URLSearchParams(props.carry);
  back.set("billing", billing);
  back.set("checkout", "1");
  const next = `/signup/family?${back.toString()}`;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="plan" className="flex flex-col gap-6 rounded-[var(--radius-panel)] bg-sunshine/35 p-5 sm:p-8">
        <StepHeading n={1} id="plan">
          Choose how to pay
        </StepHeading>
        <BillingChoice monthlyCents={props.monthlyCents} annualCents={props.annualCents} monthlyCredits={props.monthlyCredits} initial={props.initial} onChange={setBilling} />
        <PlanIncludes />
        {!props.paymentsOn && (
          <p data-testid="checkout-off" className="rounded-2xl bg-surface/80 p-4 text-lg">
            Checkout isn&apos;t switched on yet, so nothing will be charged.
          </p>
        )}
      </section>
      <section aria-labelledby="acct" className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-surface p-5 text-lg ring-[3px] ring-ink/10 sm:p-8">
        <StepHeading n={2} id="acct">
          {props.signedInAs ? "Check out" : "Enter your email, then pay"}
        </StepHeading>
        {props.signedInAs ? (
          <>
            <p>
              Signed in as <strong>{props.signedInAs}</strong>. Readli Family is added to this account, and anything you already have, like
              your voice and the families you share it with, stays as it is.
            </p>
            <button type="button" className={`${buttonPrimary} min-h-16 w-full text-xl`} disabled={busy} onClick={() => void run()} data-testid="family-checkout">
              {busy ? "Opening checkout…" : props.paymentsOn ? "Continue to checkout" : "Start my family"}
            </button>
            {error && (
              <p role="alert" className="font-semibold text-coral-deep">
                {error}
              </p>
            )}
          </>
        ) : (
          <>
            <p>We&apos;ll email you a 6-digit code to type in here. Then you go straight to secure checkout. Already have a Readli account? Use the same email.</p>
            <LoginForm next={next} askMarketing signup="Readli Family" submitLabel="Email me my code" onSignedIn={checkout} />
          </>
        )}
      </section>
    </div>
  );
}

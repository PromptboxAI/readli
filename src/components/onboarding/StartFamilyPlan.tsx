"use client";

import { useState } from "react";
import { BillingChoice, type Billing } from "@/components/accounts/BillingChoice";
import { buttonPrimary } from "@/components/brand/buttons";
import { startFamilyCheckout } from "@/lib/accounts/family-checkout";

/**
 * The welcome's Readli Family choice: monthly or yearly, then one big button straight to checkout. The
 * family is started with the name typed earlier in the welcome. Extra storyteller slots aren't sold here:
 * a new family adds them later, from Plan & credits, once they know they need them.
 */
export function StartFamilyPlan(props: { monthlyCents: number; annualCents: number; monthlyCredits: number; familyName: string | null; paymentsOn: boolean }) {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!props.paymentsOn) {
        // Before payments are on there's nothing to buy, but the family still starts.
        const res = await fetch("/api/family/household", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(props.familyName ? { name: props.familyName } : { provisional: true }),
        });
        if (!res.ok) throw new Error("Your family couldn't be started. Please try again.");
        window.location.assign("/family");
        return;
      }
      await startFamilyCheckout({
        billing,
        cents: billing === "annual" ? props.annualCents : props.monthlyCents,
        familyName: props.familyName,
        from: "start",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout couldn't start. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <BillingChoice monthlyCents={props.monthlyCents} annualCents={props.annualCents} monthlyCredits={props.monthlyCredits} initial="monthly" onChange={setBilling} />
      <button type="button" className={`${buttonPrimary} min-h-16 w-full text-xl`} disabled={busy} onClick={() => void start()} data-testid="start-checkout">
        {busy ? "Opening checkout…" : props.paymentsOn ? "Start Readli Family" : "Start my family"}
      </button>
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </div>
  );
}

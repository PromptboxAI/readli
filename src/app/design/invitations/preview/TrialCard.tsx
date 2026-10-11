"use client";

import { useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";

interface Props {
  trialDays: number;
  trialCredits: number;
  monthly: string;
  annual: string;
  savingsPercent: number;
  renewsOn: string;
}

/** Trial offer with the billing cycle choice and an exact future-charge disclosure. */
export function TrialCard({ trialDays, trialCredits, monthly, annual, savingsPercent, renewsOn }: Props) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const price = cycle === "monthly" ? `${monthly} a month` : `${annual} a year`;
  return (
    <section aria-labelledby="trial-h" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sunshine/50 p-6 sm:p-8" data-testid="trial-card">
      <h2 id="trial-h" className="font-display text-3xl font-semibold">
        Hear June read to your children every night
      </h2>
      <ul className="flex flex-col gap-1 text-lg">
        <li>✓ {trialDays} days free</li>
        <li>✓ {trialCredits} narration credits to prepare your first stories in June&apos;s voice</li>
        <li>✓ Up to 6 child profiles, and the whole Readli library</li>
      </ul>
      <div role="radiogroup" aria-label="Billing after your trial" className="grid grid-cols-2 gap-2 rounded-full bg-surface p-1">
        {(["monthly", "yearly"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cycle === c}
            onClick={() => setCycle(c)}
            className={`min-h-12 rounded-full font-display font-semibold ${cycle === c ? "bg-ink text-white" : ""}`}
          >
            {c === "monthly" ? `Monthly · ${monthly}` : `Yearly · ${annual}`}
          </button>
        ))}
      </div>
      {cycle === "yearly" && <p className="text-sm">Yearly saves about {savingsPercent}% compared with paying monthly. Credits still arrive every month.</p>}
      <p className="rounded-2xl bg-surface p-4" data-testid="renewal-disclosure">
        Free until <strong>{renewsOn}</strong>. Then <strong>{price}</strong>, renewing automatically until you cancel. A card is required to start.
        Cancel before {renewsOn} and you won&apos;t be charged.
      </p>
      <button type="button" className={`${buttonPrimary} w-full sm:w-fit`} disabled>
        Start Your Free Family Trial
      </button>
      <p className="text-sm text-muted">Checkout opens when Readli Family launches. Until then this button stays off and nothing is charged.</p>
    </section>
  );
}

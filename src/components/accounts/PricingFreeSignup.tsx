"use client";

import { useState } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { PlanList } from "@/components/accounts/PlanList";

/** Where the pricing page's free signup sends a new grown-up: Family Home, which opens the welcome (/start) for anyone without a plan. */
export const PRICING_FREE_NEXT = "/home?from=pricing";

const TOUR = ["Name your family", "Record your voice in a few minutes", "Hear it read a real story", "Choose a plan only if you love it"];

/**
 * The third way in from /pricing, below the two plans: sign up free and walk the whole welcome before
 * choosing anything. It's the same email code or Google sign-in as everywhere else; the welcome ends on
 * the plan page, where Readli Family or free Readli Voice are both a choice.
 */
export function PricingFreeSignup() {
  const [sent, setSent] = useState(false);
  return (
    <section
      aria-labelledby="free-signup-heading"
      data-testid="pricing-free-signup"
      className="mx-auto mt-10 grid w-full max-w-5xl gap-6 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8 md:grid-cols-2 md:gap-10"
    >
      <div className="flex flex-col gap-3">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-coral-deep">Not ready to choose?</p>
        <h2 id="free-signup-heading" className="font-display text-3xl font-semibold">
          {sent ? "Check your email" : "Sign up free and take a look"}
        </h2>
        <p className="text-lg">See everything Readli does before you pick a plan. No card needed.</p>
        <PlanList items={TOUR} />
      </div>
      <div className="flex flex-col justify-center">
        <LoginForm next={PRICING_FREE_NEXT} onSentChange={setSent} askMarketing signup="Readli Family" source="pricing_free" submitLabel="Sign up free" />
      </div>
    </section>
  );
}

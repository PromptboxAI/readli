"use client";

import { useState } from "react";

export type Billing = "monthly" | "annual";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Monthly or yearly Readli Family as two large cards, then one plain sentence saying what was picked and
 * what it costs today. Sized for grown-ups who'd rather not squint: big prices, big radios, no fine print.
 */
export function BillingChoice({
  monthlyCents,
  annualCents,
  monthlyCredits,
  initial,
  onChange,
}: {
  monthlyCents: number;
  annualCents: number;
  monthlyCredits: number;
  initial: Billing;
  onChange?: (billing: Billing) => void;
}) {
  const [billing, setBillingState] = useState<Billing>(initial);
  const setBilling = (b: Billing) => {
    setBillingState(b);
    onChange?.(b);
  };
  const savings = Math.round((1 - annualCents / (12 * monthlyCents)) * 100);
  const options = [
    { id: "monthly" as const, label: "Monthly", price: money(monthlyCents), unit: " a month", note: "Cancel any time.", badge: null },
    {
      id: "annual" as const,
      label: "Yearly",
      price: money(annualCents),
      unit: " a year",
      note: `That's ${money(Math.round(annualCents / 12))} a month, paid once a year.`,
      badge: savings > 0 ? `Best value · Save ${savings}%` : null,
    },
  ];
  const chosen = options.find((o) => o.id === billing)!;
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="grid gap-5 pt-3 sm:grid-cols-2">
        <legend className="sr-only">How would you like to pay?</legend>
        {options.map((o) => (
          <label
            key={o.id}
            className={`relative flex cursor-pointer flex-col gap-2 rounded-3xl border-4 bg-surface p-5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-coral-deep sm:p-6 ${billing === o.id ? "border-ink shadow-[0_6px_0_rgba(40,53,72,0.18)]" : "border-ink/15 hover:border-ink/40"}`}
          >
            {o.badge && <span className="absolute -top-3.5 right-4 rounded-full bg-mint-deep px-3 py-0.5 text-base font-bold text-white">{o.badge}</span>}
            <span className="flex items-center gap-3">
              <input type="radio" name="billing" value={o.id} checked={billing === o.id} onChange={() => setBilling(o.id)} className="size-6 shrink-0 accent-coral-deep" />
              <span className="font-display text-2xl font-semibold">{o.label}</span>
            </span>
            <span className="font-display text-4xl font-semibold" data-testid={`price-${o.id}`}>
              {o.price}
              <span className="font-sans text-lg font-normal text-muted">{o.unit}</span>
            </span>
            <span className="text-lg text-muted">{o.note}</span>
          </label>
        ))}
      </fieldset>
      <p className="rounded-2xl border-2 border-ink/15 bg-surface px-5 py-4 text-lg" aria-live="polite">
        You chose <strong>{chosen.label}</strong>:{" "}
        <strong data-testid="family-price">{chosen.price}</strong> today.{" "}
        {billing === "annual" ? `Renews yearly, and your ${monthlyCredits} narration credits still arrive every month.` : "Renews monthly. Cancel any time."}
      </p>
    </div>
  );
}

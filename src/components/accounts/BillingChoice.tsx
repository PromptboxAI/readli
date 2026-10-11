"use client";

import { useState } from "react";

export type Billing = "monthly" | "annual";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Monthly or yearly Readli Family, with the total that goes with it. */
export function BillingChoice({ monthlyCents, annualCents, monthlyCredits, initial }: { monthlyCents: number; annualCents: number; monthlyCredits: number; initial: Billing }) {
  const [billing, setBilling] = useState<Billing>(initial);
  const savings = Math.round((1 - annualCents / (12 * monthlyCents)) * 100);
  const options = [
    { id: "monthly" as const, label: "Monthly", price: money(monthlyCents), unit: "/month", note: "Cancel any time." },
    { id: "annual" as const, label: "Yearly", price: money(annualCents), unit: "/year", note: savings > 0 ? `Save about ${savings}%` : "Billed once a year." },
  ];
  const chosen = options.find((o) => o.id === billing)!;
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">How would you like to pay?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <label
              key={o.id}
              className={`flex cursor-pointer flex-col gap-1 rounded-2xl bg-surface p-4 ring-[3px] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${billing === o.id ? "ring-ink" : "ring-ink/10 hover:ring-ink/30"}`}
            >
              <span className="flex items-center gap-2">
                <input type="radio" name="billing" value={o.id} checked={billing === o.id} onChange={() => setBilling(o.id)} className="size-5 accent-coral-deep" />
                <span className="font-display text-lg font-semibold">{o.label}</span>
              </span>
              <span className="font-display text-xl" data-testid={`price-${o.id}`}>
                {o.price}
                <span className="text-base text-muted">{o.unit}</span>
              </span>
              <span className="text-sm text-muted">{o.note}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 border-t-2 border-ink/10 pt-3" aria-live="polite">
        <dt>{billing === "annual" ? "Yearly total" : "Monthly total"}</dt>
        <dd className="font-semibold" data-testid="family-price">
          {chosen.price}
        </dd>
        <dt className="text-sm text-muted">
          {billing === "annual" ? `Renews yearly. Your ${monthlyCredits} narration credits still arrive every month.` : "Renews monthly. Cancel any time."}
        </dt>
        <dd />
      </dl>
    </div>
  );
}

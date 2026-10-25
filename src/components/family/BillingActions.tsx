"use client";

import { useEffect, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { formatPrice } from "@/lib/family/plan";
import { rememberCheckout, takeCheckout, trackMeta } from "@/lib/marketing/meta-pixel";

async function goTo(path: string, body: unknown, setError: (e: string) => void) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (res.ok && json.url) window.location.assign(json.url);
  else setError(json.error?.message ?? "Something went wrong. Please try again.");
}

/** Pick monthly or annual Readli Family, with optional extra storyteller slots, then go to checkout. */
export function StartPlan(props: { monthlyCents: number; annualCents: number; slotCents: number; slotsForSale: boolean; includedSlots: number; paymentsOn: boolean }) {
  const [choice, setChoice] = useState<"family_monthly" | "family_annual">("family_monthly");
  const [extra, setExtra] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const base = choice === "family_monthly" ? props.monthlyCents : props.annualCents;
  const savings = Math.round((1 - props.annualCents / (props.monthlyCents * 12)) * 100);
  return (
    <div className="flex flex-col gap-4" data-testid="start-plan">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">How often to pay</legend>
        {(
          [
            ["family_monthly", "Monthly", `${formatPrice(props.monthlyCents)} a month`],
            ["family_annual", "Yearly", `${formatPrice(props.annualCents)} a year${savings > 0 ? `, about ${savings}% less` : ""}`],
          ] as const
        ).map(([id, label, price]) => (
          <label key={id} className={`flex cursor-pointer flex-col gap-1 rounded-3xl p-4 ring-2 ${choice === id ? "bg-sunshine/50 ring-ink" : "bg-surface ring-ink/15"}`}>
            <span className="flex items-center gap-2 font-display text-lg font-semibold">
              <input type="radio" name="interval" checked={choice === id} onChange={() => setChoice(id)} />
              {label}
            </span>
            <span>{price}</span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm">Includes {props.includedSlots} family storyteller slots and monthly narration credits, on either plan.</p>
      {props.slotsForSale && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
          <span>
            <span className="block font-semibold">Extra storyteller slots</span>
            <span className="text-sm">{formatPrice(props.slotCents)} a month each, for Grandma, Grandpa or another special voice</span>
          </span>
          <span className="flex items-center gap-2">
            <button type="button" aria-label="One fewer slot" className="grid size-11 place-items-center rounded-full border-[3px] border-ink font-display text-xl disabled:opacity-40" disabled={extra <= 0} onClick={() => setExtra(extra - 1)}>
              −
            </button>
            <output aria-live="polite" aria-label="Extra slots" className="w-8 text-center font-display text-2xl">
              {extra}
            </output>
            <button type="button" aria-label="One more slot" className="grid size-11 place-items-center rounded-full border-[3px] border-ink font-display text-xl disabled:opacity-40" disabled={extra >= 4} onClick={() => setExtra(extra + 1)}>
              +
            </button>
          </span>
        </div>
      )}
      <p data-testid="plan-total" className="font-semibold">
        {formatPrice(base)} {choice === "family_monthly" ? "a month" : "a year"}
        {extra > 0 ? ` plus ${formatPrice(extra * props.slotCents)} a month for ${extra} extra ${extra === 1 ? "slot" : "slots"}` : ""}. Renews automatically until you cancel.
      </p>
      {!props.paymentsOn && (
        <p data-testid="payments-off" className="rounded-2xl bg-surface/80 p-3 text-sm ring-2 ring-ink/10">
          Payments aren&apos;t switched on yet, so nothing can be charged.
        </p>
      )}
      {error && <p role="alert" className="rounded-2xl bg-coral/30 p-3 text-sm">{error}</p>}
      <button
        type="button"
        className={`${buttonPrimary} self-start`}
        disabled={!props.paymentsOn || busy}
        onClick={() => {
          setBusy(true);
          setError("");
          const cents = base + extra * props.slotCents;
          trackMeta("InitiateCheckout", { value: cents / 100, currency: "USD", content_name: choice });
          rememberCheckout(cents);
          void goTo("/api/billing/checkout", { item: choice, extraSlots: extra }, setError).finally(() => setBusy(false));
        }}
      >
        Continue to checkout
      </button>
    </div>
  );
}

/** Back from Stripe: reports the new plan to the Meta Pixel once, if this tab started the checkout. */
export function CheckoutDone() {
  useEffect(() => {
    const cents = takeCheckout();
    if (cents !== null) trackMeta("Subscribe", { value: cents / 100, currency: "USD" });
  }, []);
  return null;
}

/** Opens Stripe's page for changing the card, slots or canceling. */
export function ManagePlan({ paymentsOn }: { paymentsOn: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col gap-2">
      {error && <p role="alert" className="rounded-2xl bg-coral/30 p-3 text-sm">{error}</p>}
      <button
        type="button"
        className={`${buttonSecondary} self-start`}
        disabled={!paymentsOn || busy}
        onClick={() => {
          setBusy(true);
          setError("");
          void goTo("/api/billing/portal", {}, setError).finally(() => setBusy(false));
        }}
      >
        Change card, slots or cancel
      </button>
    </div>
  );
}

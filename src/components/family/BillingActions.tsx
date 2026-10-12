"use client";

import { useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { formatPrice } from "@/lib/family/plan";
import { PlanChangeConfirm, ScheduledPlanChange, type PlanTarget } from "./PlanChange";

async function goTo(path: string, body: unknown, setError: (e: string) => void) {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
  if (res.ok && json.url) window.location.assign(json.url);
  else setError(json.error?.message ?? "Something went wrong. Please try again.");
}

/** Pick monthly or annual Readli Family, with optional extra storyteller slots, then go to checkout. */
export function StartPlan(props: {
  monthlyCents: number;
  annualCents: number;
  slotCents: number;
  slotsForSale: boolean;
  includedSlots: number;
  paymentsOn: boolean;
  /** Free-trial days for this family; 0 when they've had Readli Family before. */
  trialDays: number;
  trialCredits: number;
}) {
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
      {props.trialDays > 0 && (
        <div className="flex flex-col gap-1 rounded-3xl bg-mint/60 p-4" data-testid="trial-offer">
          <p className="font-display text-lg font-semibold">Free for {props.trialDays} days</p>
          <p className="text-sm">
            Your trial includes {props.trialCredits} narration credits. We ask for a card at checkout, and nothing is charged until the trial ends.
            Cancel before then and you won&apos;t pay anything.
          </p>
        </div>
      )}
      <p data-testid="plan-total" className="font-semibold">
        {props.trialDays > 0 ? "After your trial, " : ""}
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
          void goTo("/api/billing/checkout", { item: choice, extraSlots: extra }, setError).finally(() => setBusy(false));
        }}
      >
        {props.trialDays > 0 ? "Start your free trial" : "Continue to checkout"}
      </button>
    </div>
  );
}

/**
 * Stripe's page for changing the card, slots or canceling, and Readli's own switch between monthly and
 * yearly billing, confirmed after a preview of the date and amounts.
 */
export function ManagePlan(props: {
  paymentsOn: boolean;
  interval?: "month" | "year" | null;
  monthlyCents?: number;
  annualCents?: number;
  hasExtraSlots?: boolean;
  inTrial?: boolean;
}) {
  const { paymentsOn } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [choosing, setChoosing] = useState<"family_monthly" | "family_annual" | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {error && <p role="alert" className="rounded-2xl bg-coral/30 p-3 text-sm">{error}</p>}
      {done && <p role="status" className="rounded-2xl bg-mint/40 p-3 text-sm">{done}</p>}
      <ScheduledPlanChange paymentsOn={paymentsOn} />
      {choosing ? (
        <PlanChangeConfirm
          to={choosing}
          downgrade={choosing === "family_monthly"}
          inTrial={Boolean(props.inTrial)}
          onCancel={() => setChoosing(null)}
          onDone={(message) => {
            setChoosing(null);
            setDone(message);
          }}
        />
      ) : (
        <>
          {props.interval === "month" && props.annualCents !== undefined && !props.hasExtraSlots && (
            <button type="button" className={`${buttonSecondary} self-start`} disabled={!paymentsOn || busy} onClick={() => setChoosing("family_annual")}>
              Pay yearly instead ({formatPrice(props.annualCents)} a year)
            </button>
          )}
          {props.interval === "year" && props.monthlyCents !== undefined && (
            <button type="button" className={`${buttonSecondary} self-start`} disabled={!paymentsOn || busy} onClick={() => setChoosing("family_monthly")}>
              Pay monthly instead ({formatPrice(props.monthlyCents)} a month)
            </button>
          )}
        </>
      )}
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

/**
 * Readli Family ↔ Family Archive. On a tester plan or in the preview the switch happens here; a Stripe
 * subscription changes through Readli's plan change (the webhook then moves the family); a family whose
 * plan ended can start the Archive.
 */
export function ArchiveChoice(props: {
  tier: "family" | "archive" | null;
  tierChange: "direct" | "stripe" | null;
  priceCents: number;
  monthlyCents?: number;
  annualCents?: number;
  paymentsOn: boolean;
  inTrial?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [choosing, setChoosing] = useState<PlanTarget | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const price = `${formatPrice(props.priceCents)} a month`;

  const switchTo = async (tier: "family" | "archive") => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/family/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tier }) });
    const json = (await res.json().catch(() => ({}))) as { stoppedJobs?: number; error?: { message?: string } };
    setBusy(false);
    setConfirming(false);
    if (!res.ok) return setError(json.error?.message ?? "Something went wrong. Please try again.");
    setDone(tier === "archive" ? "You're on the Family Archive. Your stories, kids profiles and permissions are all here." : "Welcome back to Readli Family. You can prepare new stories again.");
    window.location.reload();
  };
  const act = (tier: "family" | "archive", yearly = false) =>
    props.tierChange === "direct" ? void switchTo(tier) : setChoosing(tier === "archive" ? "archive_monthly" : yearly ? "family_annual" : "family_monthly");
  const canAct = props.tierChange === "direct" || (props.tierChange === "stripe" && props.paymentsOn);

  const confirmStripe = choosing && (
    <PlanChangeConfirm
      to={choosing}
      downgrade={choosing === "archive_monthly"}
      inTrial={Boolean(props.inTrial)}
      onCancel={() => {
        setChoosing(null);
        setConfirming(false);
      }}
      onDone={(message) => {
        setChoosing(null);
        setConfirming(false);
        setDone(`${message} Nothing in your library changes.`);
      }}
    />
  );

  return (
    <div className="flex flex-col gap-3" data-testid="archive-choice">
      {confirmStripe}
      {props.tier === "family" && !choosing && (
        <>
          <p>
            Not making new stories for a while? The Readli Family Archive keeps every story you&apos;ve prepared, your kids profiles,
            storytellers and permissions, and your kids keep listening, for {price}. It doesn&apos;t include new stories, monthly credits
            or extra narrator slots, and nothing is deleted when you move. Come back to Readli Family whenever you like.
          </p>
          {confirming ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-sunshine/40 p-4">
              <p className="font-semibold">
                Move to the Archive? Any story still being prepared stops, and the credits it hadn&apos;t used go back to your balance for when you return.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={buttonPrimary} disabled={busy} onClick={() => act("archive")}>
                  Move to the Archive
                </button>
                <button type="button" className={buttonSecondary} disabled={busy} onClick={() => setConfirming(false)}>
                  Stay on Readli Family
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={`${buttonSecondary} self-start`} disabled={!canAct || busy} onClick={() => setConfirming(true)}>
              Move to the Family Archive
            </button>
          )}
        </>
      )}
      {props.tier === "archive" && !choosing && (
        <>
          <p>Your stories, kids profiles and permissions are kept and your kids can keep listening. Return to Readli Family to prepare new stories again.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonPrimary} disabled={!canAct || busy} onClick={() => act("family")}>
              {props.tierChange === "stripe" && props.monthlyCents !== undefined ? `Return to Readli Family (${formatPrice(props.monthlyCents)} a month)` : "Return to Readli Family"}
            </button>
            {props.tierChange === "stripe" && props.annualCents !== undefined && (
              <button type="button" className={buttonSecondary} disabled={!canAct || busy} onClick={() => act("family", true)}>
                Return yearly ({formatPrice(props.annualCents)} a year)
              </button>
            )}
          </div>
        </>
      )}
      {props.tier === null && (
        <>
          <p>Keep your family&apos;s stories, kids profiles and permissions, and keep listening, with the Family Archive for {price}.</p>
          <button
            type="button"
            className={`${buttonSecondary} self-start`}
            disabled={!props.paymentsOn || busy}
            onClick={() => {
              setBusy(true);
              setError("");
              void goTo("/api/billing/checkout", { item: "archive_monthly" }, setError).finally(() => setBusy(false));
            }}
          >
            Keep my stories with the Archive
          </button>
        </>
      )}
      {props.tierChange === "stripe" && !props.paymentsOn && props.tier !== null && (
        <p className="rounded-2xl bg-surface/80 p-3 text-sm ring-2 ring-ink/10">Payments aren&apos;t switched on yet, so plan changes wait for that.</p>
      )}
      {error && <p role="alert" className="rounded-2xl bg-coral/30 p-3 text-sm">{error}</p>}
      {done && <p role="status" className="rounded-2xl bg-mint/40 p-3 text-sm">{done}</p>}
    </div>
  );
}

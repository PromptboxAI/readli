"use client";

import { useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import { RecipientLink } from "./RecipientPlay";

interface Props {
  token: string;
  name: string;
  monthly: string;
  annual: string;
  monthlyCredits: number;
  savingsPercent: number;
  /** Where Readli Family starts; ?billing= is added. Null while checkout is off. */
  startHref: string | null;
  /** While checkout is off: saves the storyteller to a new family for later. */
  laterHref: string;
}

/**
 * "New to Readli Family?" on an invitation page: the live plan prices and terms. There is no free
 * trial, so the card says plainly that the card is charged at checkout. While checkout is off it
 * offers saving the storyteller for later instead of a button that can't work.
 */
export function FamilyOffer({ token, name, monthly, annual, monthlyCredits, savingsPercent, startHref, laterHref }: Props) {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  return (
    <section aria-labelledby="new-h" className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-panel)] bg-sunshine/50 p-5 sm:p-6" data-testid="family-offer">
      <h2 id="new-h" className="font-display text-2xl font-semibold">
        New to Readli Family?
      </h2>
      <p>Your children can hear {name} read classic storybooks, any night.</p>
      {startHref ? (
        <>
          <div role="radiogroup" aria-label="How you'd like to pay" className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
            {(["monthly", "annual"] as const).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)} className={`min-h-11 rounded-full font-display font-semibold ${cycle === c ? "bg-ink text-white" : ""}`}>
                {c === "monthly" ? `Monthly · ${monthly}` : `Yearly · ${annual}`}
              </button>
            ))}
          </div>
          <p className="rounded-2xl bg-surface p-3 text-sm leading-relaxed" data-testid="billing-disclosure">
            {cycle === "monthly" ? `${monthly} a month` : `${annual} a year`}, charged when you check out, with {monthlyCredits} narration credits every month. Renews {cycle === "monthly" ? "monthly" : "yearly"} until you cancel, which
            you can do any time in Billing.{cycle === "annual" ? ` Yearly saves about ${savingsPercent}%.` : ""}
          </p>
          <RecipientLink token={token} event="family_cta" href={`${startHref}?billing=${cycle}`} className={`${buttonPrimary} w-full`} testId="start-family">
            Start Readli Family
          </RecipientLink>
        </>
      ) : (
        <>
          <p className="rounded-2xl bg-surface p-3 text-sm leading-relaxed" data-testid="billing-disclosure">
            Readli Family memberships aren&apos;t open for purchase yet, so nothing is charged. Save {name} to your family now, and start your membership when it opens.
          </p>
          <RecipientLink token={token} event="family_cta" href={laterHref} className={`${buttonPrimary} w-full`} testId="start-family">
            Save {name} for later
          </RecipientLink>
        </>
      )}
    </section>
  );
}

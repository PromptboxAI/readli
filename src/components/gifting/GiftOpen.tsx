"use client";

import Link from "next/link";
import { useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { GiftCard } from "@/components/gifting/GiftCard";
import { TheirHome } from "@/components/gifting/TheirHome";
import { GiftBoxArt } from "@/components/invites/illustrations";
import type { GiftPlan } from "@/lib/gifting/plans";

/** The recipient's side of a gift: unwrap, see what's theirs, then claim it into their own household. */
export function GiftOpen({ plan, to, from, message }: { plan: GiftPlan; to: string; from: string; message: string }) {
  const [stage, setStage] = useState<"wrapped" | "open" | "claimed" | "declined">("wrapped");
  const term = plan.kind === "recurring" ? "every month, for as long as they sponsor you" : plan.months === 12 ? "for a whole year" : `for ${plan.name.toLowerCase()}`;

  if (stage === "wrapped") {
    return (
      <section className="flex flex-col items-center gap-5 rounded-[var(--radius-panel)] bg-sky/50 px-6 py-12 text-center">
        <GiftBoxArt className="animate-bob w-40" />
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">{from} sent you a gift</h1>
        <p className="text-lg">Hi {to}! Something storybook-shaped is waiting for you.</p>
        <button type="button" className={buttonPrimary} onClick={() => setStage("open")}>
          Open your gift
        </button>
      </section>
    );
  }

  if (stage === "claimed" || stage === "declined") {
    return (
      <section aria-live="polite" className="flex flex-col items-center gap-4 rounded-[var(--radius-panel)] bg-mint/50 px-6 py-12 text-center">
        <ReadiMascot size={140} decorative />
        <h1 className="font-display text-3xl font-semibold">{stage === "claimed" ? "Let's set up your family" : "No problem"}</h1>
        <p className="max-w-md">
          {stage === "claimed"
            ? "Family accounts are coming soon. When they arrive, this is where you'd create your account and the gift would start."
            : `We'd let ${from} know, kindly, and they'd get a full refund. This is a preview, so nothing was sent.`}
        </p>
        {stage === "claimed" ? (
          <Link href="/welcome" className={buttonPrimary}>
            See your welcome
          </Link>
        ) : (
          <button type="button" className={buttonSecondary} onClick={() => setStage("open")}>
            Back to the gift
          </button>
        )}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <GiftCard plan={plan} to={to} from={from} message={message} open />
      <section aria-labelledby="whats-inside" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
        <h2 id="whats-inside" className="font-display text-2xl font-semibold">
          What&apos;s inside
        </h2>
        <p>
          Readli for your household {term}, paid for by {from}. Hear classic storybooks read in the voices of the people your
          kids love.
        </p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {["Your family library", "Invite your own storytellers", "Kids' profiles you manage"].map((t) => (
            <li key={t} className="rounded-2xl bg-ivory p-3 font-display font-semibold">
              {t}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          You&apos;ll never be charged for this gift. When it ends we&apos;ll remind you first, and nothing renews unless you choose a plan.
        </p>
      </section>
      <TheirHome audience="recipient" giver={from} />
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <button type="button" className={buttonPrimary} onClick={() => setStage("claimed")}>
          Accept my gift
        </button>
        <Link href="/login" className={buttonSecondary}>
          I already have Readli
        </Link>
        <button type="button" className={buttonQuiet} onClick={() => setStage("declined")}>
          No thanks
        </button>
      </div>
      {plan.kind === "prepaid" && (
        <p className="text-sm text-muted">Already a member? Your gift starts when your current paid month ends, so nothing is wasted.</p>
      )}
    </div>
  );
}

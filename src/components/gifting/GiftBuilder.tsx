"use client";

import { useId, useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import type { GiftDraft } from "@/lib/gifting/params";
import { GIFT_PLANS, priceLabel, type GiftPlanId } from "@/lib/gifting/plans";

const PLAN_TINT: Record<GiftPlanId, string> = {
  prepaid_1m: "bg-sky/50",
  prepaid_3m: "bg-mint/60",
  prepaid_12m: "bg-sunshine/70",
  sponsored_monthly: "bg-lavender/60",
};

const field = "min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink";

/** Step 1 of Invite & Gift: plan, recipient and note. A plain GET form, so it works before JS loads. */
export function GiftBuilder({ today, initial }: { today: string; initial?: GiftDraft }) {
  const id = useId();
  const [plan, setPlan] = useState<GiftPlanId>(initial?.plan.id ?? "prepaid_3m");
  const [when, setWhen] = useState<"now" | "later">(initial?.date ? "later" : "now");

  return (
    <form action="/invite/gift/checkout" method="get" className="flex flex-col gap-8" aria-label="Build a gift">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-display text-2xl font-semibold">1. Choose a gift</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {GIFT_PLANS.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer flex-col gap-1 rounded-3xl p-5 ring-[3px] transition-transform has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-coral-deep ${PLAN_TINT[p.id]} ${plan === p.id ? "-translate-y-0.5 ring-ink" : "ring-transparent"}`}
            >
              <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} className="sr-only" />
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-xl font-semibold">{p.name}</span>
                <span aria-hidden="true" className={`grid size-7 place-items-center rounded-full border-[3px] border-ink ${plan === p.id ? "bg-ink text-white" : "bg-surface"}`}>
                  {plan === p.id ? "✓" : ""}
                </span>
              </span>
              <span>{p.summary}</span>
              <span className="text-sm font-semibold">{p.kind === "recurring" ? "Renews monthly, stop any time" : "Paid once, never renews"}</span>
              <span className="text-sm text-muted">{priceLabel(p)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-display text-2xl font-semibold">2. Who&apos;s it for?</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-to`} className="font-semibold">
              Their name
            </label>
            <input id={`${id}-to`} name="to" defaultValue={initial?.to} className={field} placeholder="Ben and family" required autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-email`} className="font-semibold">
              Their email
            </label>
            <input id={`${id}-email`} name="email" type="email" defaultValue={initial?.email} className={field} required autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-from`} className="font-semibold">
              From
            </label>
            <input id={`${id}-from`} name="from" defaultValue={initial?.from} className={field} placeholder="Nana Rose" required autoComplete="name" />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-semibold">When should it arrive?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["now", "Right away"],
                  ["later", "Pick a date"],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-2xl font-display ring-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-coral-deep ${when === v ? "bg-sky/60 ring-ink" : "bg-surface ring-ink/15"}`}>
                  <input type="radio" name="when" value={v} checked={when === v} onChange={() => setWhen(v)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            {when === "later" && (
              <input aria-label="Delivery date" type="date" name="date" min={today} defaultValue={initial?.date ?? today} className={field} required />
            )}
          </fieldset>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-msg`} className="font-semibold">
            A note for them <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id={`${id}-msg`}
            name="message"
            defaultValue={initial?.message}
            rows={3}
            maxLength={300}
            className="w-full rounded-2xl border-[3px] border-ink/20 bg-surface p-4 text-lg focus:border-ink"
            placeholder="For bedtime stories with the little ones. Love, Nana"
          />
        </div>
      </fieldset>

      <button type="submit" className={`${buttonPrimary} w-full sm:w-fit`}>
        Review gift
      </button>
    </form>
  );
}

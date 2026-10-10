"use client";

import { useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import { DEFAULT_PLAN, money } from "@/lib/entitlements/config";
import { extraSlotsForSale, monthlyChargeCents } from "@/lib/entitlements/entitlements";

const IN_USE = [
  { name: "Mom", tint: "bg-coral" },
  { name: "Grandpa Lou", tint: "bg-sky" },
];

/** Buy extra active narrator slots. Not on sale while the slot price is only proposed. */
export function NarratorSlotPurchase() {
  const [add, setAdd] = useState(1);
  const forSale = extraSlotsForSale();
  const included = DEFAULT_PLAN.includedNarratorSlots;
  const total = monthlyChargeCents({ source: "paid", extraNarratorSlots: add });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <section aria-labelledby="slots-now" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
        <h2 id="slots-now" className="font-display text-2xl font-semibold">
          Your narrator slots
        </h2>
        <p>
          Readli Family includes {included}. Both are in use. A slot holds one storyteller whose owner has shared their voice with
          you.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="slots">
          {IN_USE.map((s) => (
            <li key={s.name} className="flex items-center gap-3 rounded-2xl bg-ivory p-4">
              <span aria-hidden="true" className={`size-10 rounded-full ${s.tint}`} />
              <span className="font-display font-semibold">{s.name}</span>
            </li>
          ))}
          {Array.from({ length: add }, (_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl border-[3px] border-dashed border-ink/30 p-4">
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-sunshine font-display text-xl">
                +
              </span>
              <span className="font-display">New slot</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          A new slot doesn&apos;t switch anyone on by itself. You pick an authorized storyteller for it, then approve them for each
          child.
        </p>
      </section>

      <section aria-labelledby="add" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sunshine/50 p-6 sm:p-8">
        <h2 id="add" className="font-display text-2xl font-semibold">
          Add narrator slots
        </h2>
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4">
          <span>
            <span className="block font-display text-lg font-semibold">Extra slot</span>
            <span className="text-sm">{money(DEFAULT_PLAN.extraNarratorSlotPriceCents)} a month each</span>
          </span>
          <span className="flex items-center gap-2">
            <button type="button" aria-label="One fewer slot" className="grid size-11 place-items-center rounded-full border-[3px] border-ink font-display text-xl disabled:opacity-40" disabled={add <= 1} onClick={() => setAdd(add - 1)}>
              −
            </button>
            <output aria-live="polite" aria-label="Slots to add" className="w-8 text-center font-display text-2xl">
              {add}
            </output>
            <button type="button" aria-label="One more slot" className="grid size-11 place-items-center rounded-full border-[3px] border-ink font-display text-xl disabled:opacity-40" disabled={add >= 4} onClick={() => setAdd(add + 1)}>
              +
            </button>
          </span>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1">
          <dt>Readli Family</dt>
          <dd>{money(DEFAULT_PLAN.familyMonthlyPriceCents)}</dd>
          <dt>
            {add} extra {add === 1 ? "slot" : "slots"}
          </dt>
          <dd>{money(add * DEFAULT_PLAN.extraNarratorSlotPriceCents)}</dd>
          <dt className="border-t-2 border-ink/10 pt-2 font-semibold">New monthly total</dt>
          <dd className="border-t-2 border-ink/10 pt-2 font-semibold" data-testid="slot-total">
            {money(total)}
          </dd>
        </dl>
        {!forSale && (
          <p data-testid="slots-not-for-sale" className="rounded-2xl bg-surface/80 p-3 text-sm">
            Extra slots go on sale once their price is approved. Nothing will be charged.
          </p>
        )}
        <button type="button" className={`${buttonPrimary} w-full`} disabled={!forSale}>
          Add {add} {add === 1 ? "slot" : "slots"}
        </button>
        <p className="text-sm text-muted">Storytellers are never charged for being in your family. You can remove extra slots any time.</p>
      </section>
    </div>
  );
}

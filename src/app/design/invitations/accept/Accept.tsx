"use client";

import { useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";

const KIDS = ["Maya", "Leo"];

/** Existing subscriber connects the contributor: slot choice, then child-by-child approval. */
export function Accept({ slotPrice, includedSlots }: { slotPrice: string; includedSlots: number }) {
  const [slot, setSlot] = useState<"add" | "later">("later");
  const [kids, setKids] = useState<Record<string, boolean>>({});
  return (
    <form className="flex min-w-0 flex-col gap-6" onSubmit={(e) => e.preventDefault()} data-testid="circle-accept">
      <fieldset className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-sky/30 p-5 sm:p-6">
        <legend className="mb-2 font-display text-xl font-semibold">Make June a storyteller</legend>
        <p className="text-sm">
          {includedSlots} of {includedSlots} storyteller slots are in use (Mom, Dad).
        </p>
        <label className="flex items-start gap-3 rounded-2xl bg-surface p-4">
          <input type="radio" name="slot" className="mt-1 size-5 accent-coral-deep" checked={slot === "later"} onChange={() => setSlot("later")} />
          <span>
            <span className="block font-semibold">Keep June ready, decide later</span>
            <span className="text-sm">She&apos;s in your Family Circle. You can swap her into a slot any time.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-2xl bg-surface p-4">
          <input type="radio" name="slot" className="mt-1 size-5 accent-coral-deep" checked={slot === "add"} onChange={() => setSlot("add")} />
          <span>
            <span className="block font-semibold">Add a storyteller slot for June · {slotPrice} a month</span>
            <span className="text-sm">Added to your Readli Family bill each month, prorated for this month. Remove it any time.</span>
          </span>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-mint/40 p-5 sm:p-6">
        <legend className="mb-2 font-display text-xl font-semibold">Which children can hear June?</legend>
        {KIDS.map((k) => (
          <label key={k} className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4">
            <span className="font-display text-lg font-semibold">{k}</span>
            <input
              type="checkbox"
              role="switch"
              className="size-6 accent-coral-deep"
              checked={Boolean(kids[k])}
              onChange={(e) => setKids((s) => ({ ...s, [k]: e.target.checked }))}
              aria-label={`${k} can hear June`}
            />
          </label>
        ))}
        <p className="text-sm">Nobody hears June until you switch them on here. You can change this any time.</p>
      </fieldset>

      <button className={`${buttonPrimary} w-full sm:w-fit`}>{slot === "add" ? `Add June · ${slotPrice} a month` : "Add June to our Family Circle"}</button>
    </form>
  );
}

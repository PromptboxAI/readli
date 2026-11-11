"use client";

import { useState } from "react";
import { parentPrimary, parentSecondary } from "@/components/brand/buttons";
import { formatPrice } from "@/lib/family/plan";
import type { NarratorSlotsView } from "@/lib/family/service";

/**
 * Buying or dropping an extra storyteller slot on a paid family plan, under Family storytellers. Stripe's
 * billing page can't change slots, so this is where it happens. Adding charges the rest of this billing
 * period now; removing needs an empty slot and credits the unused time on the next bill. Only the parent
 * who manages the plan can change it.
 */
export function PaidSlots({
  view,
  owner,
  ownerName,
  onSaved,
}: {
  view: NarratorSlotsView;
  owner: boolean;
  ownerName: string;
  onSaved: (view: NarratorSlotsView, message: string) => void;
}) {
  const [confirming, setConfirming] = useState<"add" | "remove" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const free = view.total - view.active.length;
  const monthly = formatPrice(view.extraSlotPriceCents);
  const yearly = formatPrice(view.extraSlotPriceCents * 12);
  const canAdd = view.extraSlotPriceApproved;
  const canRemove = view.extra > 0 && free > 0;
  if (!canAdd && view.extra === 0) return null;

  const save = async (change: "add" | "remove") => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/billing/slots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ change }) });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(json?.error?.message ?? "That didn't work. Please try again.");
    setConfirming(null);
    onSaved(
      json as NarratorSlotsView,
      change === "add" ? "Slot added. You can put another storyteller in it now." : "Extra slot removed. The unused time comes off your next bill.",
    );
  };

  return (
    <section className="flex flex-col gap-3 rounded-panel bg-sky/30 p-5" aria-labelledby="paid-slots-h" data-testid="paid-slots">
      <h2 id="paid-slots-h" className="font-display text-2xl font-semibold">
        {free <= 0 ? "Need more storytellers?" : "Storyteller slots"}
      </h2>
      <p>
        {view.extra > 0
          ? `Your plan has ${view.included} included ${view.included === 1 ? "slot" : "slots"} and ${view.extra} extra.`
          : `Your plan includes ${view.included} ${view.included === 1 ? "slot" : "slots"}.`}{" "}
        An extra slot is {monthly} a month ({yearly} a year on a yearly plan). Storytellers never pay to share their voice.
      </p>
      {!owner ? (
        <p className="text-sm text-muted">Only {ownerName} can add or remove slots, since they manage your family&apos;s plan.</p>
      ) : confirming ? (
        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10" data-testid={`confirm-slot-${confirming}`}>
          <p className="font-display text-xl font-semibold">{confirming === "add" ? "Add 1 extra storyteller slot?" : "Remove 1 extra storyteller slot?"}</p>
          <p className="text-sm">
            {confirming === "add"
              ? "We'll charge your card on file for the rest of this billing period now, then it renews with your plan."
              : "It comes off your plan now, and the unused time is credited on your next bill."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={parentSecondary} disabled={busy} onClick={() => setConfirming(null)}>
              Cancel
            </button>
            <button type="button" className={parentPrimary} disabled={busy} onClick={() => void save(confirming)}>
              {busy ? "Saving…" : confirming === "add" ? "Add slot" : "Remove slot"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canAdd && (
            <button type="button" className={parentSecondary} onClick={() => setConfirming("add")} data-testid="add-paid-slot">
              Add a slot
            </button>
          )}
          {view.extra > 0 && (
            <button type="button" className={parentSecondary} disabled={!canRemove} onClick={() => setConfirming("remove")} data-testid="remove-paid-slot">
              Remove an extra slot
            </button>
          )}
        </div>
      )}
      {owner && view.extra > 0 && !canRemove && !confirming && <p className="text-sm text-muted">Every slot has a storyteller in it. Free one first, then you can remove the extra slot.</p>}
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </section>
  );
}

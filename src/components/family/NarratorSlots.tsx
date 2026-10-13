"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { formatPrice } from "@/lib/family/plan";
import type { NarratorCard, NarratorSlotsView } from "@/lib/family/service";
import { StorytellerAvatar } from "./StorytellerAvatar";

/** Readli Family → Narrator slots: choose which shared voices the household uses, and add slots. */
export function NarratorSlots({ initial, canBuy = true }: { initial: NarratorSlotsView; canBuy?: boolean }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const free = view.total - view.active.length;
  const price = formatPrice(view.extraSlotPriceCents);

  const call = async (url: string, body: unknown, done: string) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setMessage(json?.error?.message ?? "We couldn't save that. Please try again.");
    setView(json as NarratorSlotsView);
    setMessage(done);
  };

  const row = (n: NarratorCard, action: React.ReactNode, muted = false) => (
    <li key={n.voiceId} data-testid={`slot-${n.voiceId}`} className={`flex flex-wrap items-center gap-4 rounded-3xl p-4 ${muted ? "bg-ink/5" : "bg-surface ring-2 ring-ink/10"}`}>
      <StorytellerAvatar name={n.name} avatarUrl={n.avatarUrl} tint={n.tint} muted={muted} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl font-semibold">{n.name}</p>
        <p className="text-sm text-muted">{n.relationship}</p>
      </div>
      {action}
    </li>
  );

  if (!view.hasPlan) {
    return <p className="rounded-3xl bg-sunshine/60 p-4 font-semibold">Narrator slots come with Readli Family.</p>;
  }

  return (
    <div className="flex flex-col gap-8" data-testid="narrator-slots">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-semibold">Narrator slots</h1>
        <p className="max-w-2xl text-lg">
          Your plan includes {view.included} narrator slots{view.extra > 0 ? `, plus ${view.extra} you added` : ""}. Put a
          storyteller who has shared their voice into a slot, then choose which children can hear them.
        </p>
        <div className="flex flex-wrap gap-2" aria-label="Slots used">
          {Array.from({ length: view.total }, (_, i) => (
            <span key={i} className={`h-4 w-12 rounded-full border-2 border-ink ${i < view.active.length ? "bg-coral" : "bg-surface"}`} />
          ))}
        </div>
        <p className="font-display text-xl font-semibold" data-testid="slots-used">
          {view.active.length} of {view.total} slots in use
        </p>
      </div>

      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>

      <section className="flex flex-col gap-3" aria-label="Active narrators">
        <h2 className="font-display text-2xl font-semibold">Active narrators</h2>
        {view.active.length === 0 ? (
          <p className="rounded-3xl bg-surface p-4 text-muted">No narrators yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {view.active.map((n) =>
              row(
                n,
                <button
                  type="button"
                  className={buttonSecondary}
                  disabled={busy || view.releasesLeft === 0}
                  onClick={() => call("/api/family/narrators", { voiceId: n.voiceId, action: "release" }, `${n.name}'s slot is free. Their approvals for each child were removed.`)}
                >
                  Free this slot
                </button>,
              ),
            )}
          </ul>
        )}
        {view.releasesLeft <= 1 && (
          <p className="text-sm text-muted">
            {view.releasesLeft === 0 ? "You've changed narrators a lot this month, so slots can't be freed right now." : "You can free one more slot this month."}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-label="Shared with your family">
        <h2 className="font-display text-2xl font-semibold">Shared with your family</h2>
        <p className="text-muted">These storytellers said yes to your family. Sharing alone doesn&apos;t put them in a slot.</p>
        {view.shared.length === 0 ? (
          <p className="rounded-3xl bg-surface p-4 text-muted">Everyone who shared is already in a slot.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {view.shared.map((n) =>
              row(
                n,
                <button
                  type="button"
                  className={buttonPrimary}
                  disabled={busy || free <= 0}
                  onClick={() => call("/api/family/narrators", { voiceId: n.voiceId, action: "activate" }, `${n.name} is in a narrator slot. Now choose which children can hear them.`)}
                >
                  Add to a slot
                </button>,
              ),
            )}
          </ul>
        )}
        {free <= 0 && view.shared.length > 0 && <p className="font-semibold">All your slots are in use. Free one up or add a slot.</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-panel bg-sky/30 p-5" aria-label="Add a narrator slot">
        <h2 className="font-display text-2xl font-semibold">Add a narrator slot</h2>
        <p>
          {price} a month for each extra active narrator. Storytellers never pay to share their voice, and there&apos;s no charge
          for more children.
        </p>
        {!canBuy ? (
          <p className="text-sm text-muted">Extra slots arrive with checkout, which isn&apos;t switched on yet.</p>
        ) : !buying ? (
          <button type="button" className={`${buttonSecondary} self-start`} onClick={() => setBuying(true)}>
            Add a slot
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10" data-testid="slot-checkout">
            <p className="font-display text-xl font-semibold">1 extra narrator slot · {price}/month</p>
            <p className="text-sm text-muted">
              {view.extraSlotPriceApproved ? "" : "Price pending approval. "}Payments aren&apos;t switched on yet, so this preview adds the slot
              without charging you.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonPrimary}
                disabled={busy}
                onClick={async () => {
                  await call("/api/family/narrators/slots", null, "Slot added. You can put another storyteller in it now.");
                  setBuying(false);
                }}
              >
                Confirm slot
              </button>
              <button type="button" className={buttonSecondary} onClick={() => setBuying(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {view.waiting.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Waiting for permission">
          <h2 className="font-display text-2xl font-semibold">Waiting for permission</h2>
          <p className="text-muted">These voices aren&apos;t shared with your family yet. Only the person whose voice it is can share it.</p>
          <ul className="flex flex-col gap-3">
            {view.waiting.map((n) =>
              n.yours
                ? row(
                    n,
                    <Link href="/family/my-voice" className={buttonPrimary}>
                      Share my voice
                    </Link>,
                  )
                : row(n, <span className="rounded-full bg-sunshine px-3 py-1 text-sm font-bold">Waiting for permission</span>, true),
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

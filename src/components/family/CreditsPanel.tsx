"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import type { CreditPack } from "@/lib/family/plan";

const n = (x: number) => x.toLocaleString("en-US");
const price = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Credit packs. In the preview no payment is taken; real checkout replaces `buy` once pricing and
 * payments are approved. After buying, the parent goes straight back to the book and narrator they
 * chose, with the confirmation open.
 */
export function CreditsPanel({ packs, need, returnTo, canBuy, simulated }: { packs: CreditPack[]; need: number; returnTo: string | null; canBuy: boolean; simulated: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const buy = async (pack: CreditPack) => {
    setBusy(pack.id);
    setMessage(null);
    const res = await fetch("/api/family/narration-credits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packId: pack.id }) });
    const body = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) {
      setMessage(body?.error?.message ?? "We couldn't add credits. Please try again.");
      return;
    }
    if (returnTo) router.push(returnTo);
    else {
      setMessage(`Added ${n(pack.credits)} credits.`);
      router.refresh();
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="packs-h">
      <h2 id="packs-h" className="font-display text-2xl font-semibold">Get more narration credits</h2>
      {need > 0 && (
        <p className="rounded-2xl bg-sunshine/60 p-3 font-semibold" data-testid="need">
          You need {n(need)} more credits to prepare that book.
        </p>
      )}
      {!canBuy && <p className="font-semibold">Buying credits isn&apos;t switched on yet.</p>}
      {simulated && <p className="text-sm text-muted">Preview: no payment is taken. Pack sizes and prices are placeholders until pricing is final.</p>}
      <ul className="grid gap-3 sm:grid-cols-3">
        {packs.map((p) => (
          <li key={p.id} className={`flex flex-col gap-2 rounded-3xl bg-surface p-4 ring-2 ${p.credits >= need && need > 0 ? "ring-coral-deep" : "ring-ink/10"}`}>
            <span className="font-display text-2xl font-semibold">{n(p.credits)} credits</span>
            <span className="text-muted">{price(p.priceCents)}</span>
            <button type="button" className={buttonPrimary} disabled={!canBuy || busy !== null} onClick={() => buy(p)}>
              {busy === p.id ? "Adding…" : `Buy ${n(p.credits)}`}
            </button>
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className={message ? "font-semibold" : "sr-only"}>
        {message}
      </p>
    </section>
  );
}

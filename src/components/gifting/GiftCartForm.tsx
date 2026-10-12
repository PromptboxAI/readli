"use client";

import { useState } from "react";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { MAX_GIFTS_PER_CHECKOUT } from "@/lib/gifting/cart";
import type { GiftPlan } from "@/lib/gifting/plans";

interface Row {
  key: number;
  recipientName: string;
  recipientEmail: string;
  planId: string;
  message: string;
  deliverOn: string;
}

const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const input = "rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/15";

/** Several gifts in one checkout: each person gets their own length, email, message and date. */
export function GiftCartForm({ plans, today, open }: { plans: readonly GiftPlan[]; today: string; open: boolean }) {
  const blank = (key: number): Row => ({ key, recipientName: "", recipientEmail: "", planId: plans[plans.length - 1]!.id, message: "", deliverOn: today });
  const [giverName, setGiverName] = useState("");
  const [rows, setRows] = useState<Row[]>([blank(0), blank(1)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const price = (id: string) => plans.find((p) => p.id === id)?.priceCents ?? 0;
  const total = rows.reduce((sum, r) => sum + price(r.planId), 0);
  const set = (key: number, patch: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/billing/gift-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ giverName, gifts: rows.map((r) => ({ recipientName: r.recipientName, recipientEmail: r.recipientEmail, planId: r.planId, message: r.message, deliverOn: r.deliverOn })) }),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: { message?: string } };
      if (res.ok && json.url) window.location.assign(json.url);
      else setError(json.error?.message ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-6"
      data-testid="gift-cart"
      onSubmit={(e) => {
        e.preventDefault();
        void pay();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="font-semibold">From</span>
        <input className={input} value={giverName} onChange={(e) => setGiverName(e.target.value)} maxLength={120} placeholder="Nana Rose" required />
      </label>

      <ol className="flex flex-col gap-4">
        {rows.map((r, i) => (
          <li key={r.key} className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10" aria-label={`Gift ${i + 1}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Gift {i + 1}</h2>
              {rows.length > 1 && (
                <button type="button" className={buttonQuiet} onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
                  Remove
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="font-semibold">Who it&apos;s for</span>
                <input className={input} value={r.recipientName} onChange={(e) => set(r.key, { recipientName: e.target.value })} maxLength={120} required />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold">Their email</span>
                <input className={input} type="email" value={r.recipientEmail} onChange={(e) => set(r.key, { recipientEmail: e.target.value })} maxLength={200} required />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold">How long</span>
                <select className={input} value={r.planId} onChange={(e) => set(r.key, { planId: e.target.value })}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}, {money(p.priceCents ?? 0)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold">Send it on</span>
                <input className={input} type="date" min={today} value={r.deliverOn} onChange={(e) => set(r.key, { deliverOn: e.target.value || today })} />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Message (optional)</span>
              <textarea className={input} rows={2} value={r.message} onChange={(e) => set(r.key, { message: e.target.value })} maxLength={300} />
            </label>
          </li>
        ))}
      </ol>

      {rows.length < MAX_GIFTS_PER_CHECKOUT && (
        <button type="button" className={`${buttonSecondary} self-start`} onClick={() => setRows([...rows, blank(Math.max(...rows.map((r) => r.key)) + 1)])}>
          Add another person
        </button>
      )}

      <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-sunshine/50 p-6">
        <p className="font-display text-xl font-semibold" data-testid="gift-cart-total">
          {rows.length} {rows.length === 1 ? "gift" : "gifts"}, {money(total)}
        </p>
        <p className="text-sm">Paid once, in one checkout. Gifts never renew and never charge the people you send them to. Each person gets their own code by email on the day you pick.</p>
        {!open && (
          <p className="text-sm" data-testid="gift-cart-off">
            Gift checkout isn&apos;t switched on yet, so nothing can be charged.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-coral/30 p-3 text-sm">
            {error}
          </p>
        )}
        <button type="submit" className={`${buttonPrimary} self-start`} disabled={!open || busy}>
          Pay for {rows.length} {rows.length === 1 ? "gift" : "gifts"}
        </button>
      </div>
    </form>
  );
}

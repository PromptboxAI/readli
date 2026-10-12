"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";

interface Props {
  name: string;
  voiceId: string;
  hasPlan: boolean;
  active: boolean;
  slotsUsed: number;
  slotsTotal: number;
  slotPrice: string;
  slotsForSale: boolean;
  kids: { id: string; nickname: string; approved: boolean }[];
  checkout: { invitationId: string; billing: "monthly" | "annual"; paymentsOn: boolean } | null;
}

async function call(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? "That didn't work. Please try again.");
  return data;
}

/**
 * Family Circle acceptance: the storyteller is connected and waiting. The parent chooses a narrator
 * slot (or decides later, or adds a slot), then switches on each child. Nothing happens by default.
 */
export function CircleSetup({ name, voiceId, hasPlan, active, slotsUsed, slotsTotal, slotPrice, slotsForSale, kids, checkout }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      const out = await fn();
      router.refresh();
      return out;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const startTrial = () =>
    run(async () => {
      const data = await call("/api/billing/checkout", "POST", { item: checkout!.billing === "annual" ? "family_annual" : "family_monthly", invitationId: checkout!.invitationId });
      if (data?.url) window.location.assign(data.url);
    });

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="circle-setup">
      <p className="rounded-2xl bg-mint/60 px-4 py-3 font-semibold" role="status">
        {name} is in your Family Circle, waiting for your OK.
      </p>

      {!hasPlan && checkout && (
        <section className="flex flex-col items-start gap-3 rounded-[var(--radius-panel)] bg-sunshine/50 p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold">Start your free trial</h2>
          <p>Storytellers need Readli Family. Your trial is free; you&apos;ll see the price and renewal date again before you pay anything.</p>
          <button type="button" className={buttonPrimary} disabled={busy || !checkout.paymentsOn} onClick={startTrial} data-testid="circle-checkout">
            Start Your Free Family Trial
          </button>
          {!checkout.paymentsOn && <p className="text-sm text-muted">Checkout opens when Readli Family launches. {name} stays in your Family Circle until then.</p>}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-sky/30 p-5 sm:p-6" aria-labelledby="slot-h">
        <h2 id="slot-h" className="font-display text-xl font-semibold">
          Make {name} a storyteller
        </h2>
        {active ? (
          <p>{name} has a storyteller slot.</p>
        ) : !hasPlan ? (
          <p>Once your Readli Family plan starts, you can give {name} one of your storyteller slots.</p>
        ) : slotsUsed < slotsTotal ? (
          <>
            <p className="text-sm">
              {slotsUsed} of {slotsTotal} storyteller slots are in use.
            </p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={buttonPrimary} disabled={busy} onClick={() => run(() => call("/api/family/narrators", "POST", { voiceId, action: "activate" }))} data-testid="activate-storyteller">
                Give {name} a slot
              </button>
              <Link href="/family" className={buttonSecondary}>
                Decide later
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">
              All {slotsTotal} storyteller slots are in use. {name} stays ready in your Family Circle, and you can swap them into a slot any time.
            </p>
            {slotsForSale && (
              <Link href="/billing/narrator-slots" className={`${buttonSecondary} w-fit`} data-testid="add-slot">
                Add a storyteller slot · {slotPrice} a month
              </Link>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-mint/40 p-5 sm:p-6" aria-labelledby="kids-h">
        <h2 id="kids-h" className="font-display text-xl font-semibold">
          Which children can hear {name}?
        </h2>
        {kids.length === 0 ? (
          <p>
            Add your children&apos;s profiles first.{" "}
            <Link href="/family/kids" className="font-semibold underline underline-offset-4">
              Add a child
            </Link>
          </p>
        ) : (
          kids.map((k) => (
            <label key={k.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4">
              <span className="font-display text-lg font-semibold">{k.nickname}</span>
              <input
                type="checkbox"
                role="switch"
                className="size-6 accent-coral-deep"
                checked={k.approved}
                disabled={busy || !active}
                onChange={(e) => run(() => call(`/api/family/kids/${k.id}/storytellers`, "PUT", { changes: [{ voiceId, approved: e.target.checked }] }))}
                aria-label={`${k.nickname} can hear ${name}`}
              />
            </label>
          ))
        )}
        <p className="text-sm">{active ? `Nobody hears ${name} until you switch them on here. You can change this any time.` : `Give ${name} a storyteller slot first, then choose each child.`}</p>
      </section>
      {error && (
        <p role="alert" className="text-coral-deep">
          {error}
        </p>
      )}
    </div>
  );
}

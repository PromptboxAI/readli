"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { PlanStarting } from "@/components/family/PlanStarting";
import { newMetaEventId, rememberCheckout, trackMeta } from "@/lib/marketing/meta-pixel";

export interface StepsProps {
  token: string;
  name: string;
  /** The storyteller is in this family's Family Circle. */
  connected: boolean;
  /** The parent has no family yet: connecting starts one, named later. */
  needsFamily: boolean;
  /** Arrived from a button on the invitation page, which already said "add them". */
  autoConnect: boolean;
  voiceId: string | null;
  plan: "none" | "starting" | "active";
  checkout: { invitationId: string; billing: "monthly" | "annual"; paymentsOn: boolean; canceled: boolean; monthlyCents: number; annualCents: number; monthly: string; annual: string; monthlyCredits: number };
  active: boolean;
  slotsUsed: number;
  slotsTotal: number;
  slotPrice: string;
  slotsForSale: boolean;
  kids: { id: string; nickname: string; approved: boolean }[];
  book: { slug: string; title: string; coverUrl: string | null } | null;
}

type State = "done" | "current" | "locked";

async function call(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? "That didn't work. Please try again.");
  return data;
}

function Step({ n, state, title, note, testId, children }: { n: number; state: State; title: string; note?: string; testId: string; children?: React.ReactNode }) {
  const look = state === "current" ? "border-[3px] border-ink bg-sky/40" : state === "done" ? "bg-surface" : "bg-ink/5 text-muted";
  return (
    <li className={`flex flex-col gap-3 rounded-[var(--radius-panel)] p-4 sm:p-5 ${look}`} data-testid={testId} data-state={state}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`grid size-9 shrink-0 place-items-center rounded-full font-display font-semibold ${state === "done" ? "bg-mint text-ink" : state === "current" ? "bg-ink text-white" : "border-2 border-ink/30"}`}
        >
          {state === "done" ? "✓" : n}
        </span>
        <div className="min-w-0">
          <h2 className={`font-display text-lg font-semibold sm:text-xl ${state === "locked" ? "text-ink/70" : ""}`}>
            {title}
            {state === "done" && <span className="sr-only"> (done)</span>}
          </h2>
          {note && <p className="text-sm">{note}</p>}
        </div>
      </div>
      {state === "current" && children}
    </li>
  );
}

/**
 * After an invitation: connect the storyteller, start Readli Family if needed, give them a storyteller
 * slot, choose each child, then prepare the book they read. Each step opens once the one before is done,
 * and nothing is activated, approved or narrated without the parent pressing for it.
 */
export function StorytellerSteps(p: StepsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cycle, setCycle] = useState(p.checkout.billing);
  const tried = useRef(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const connect = () =>
    run(async () => {
      if (p.needsFamily) await call("/api/family/household", "POST", { provisional: true });
      await call("/api/invitations/accept", "POST", { token: p.token });
    });
  useEffect(() => {
    if (p.autoConnect && !p.connected && !tried.current) {
      tried.current = true;
      void connect();
    }
    // Once, on arrival from the invitation page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCheckout = () =>
    run(async () => {
      const cents = cycle === "annual" ? p.checkout.annualCents : p.checkout.monthlyCents;
      // The server reports the same checkout with this id once Stripe's session exists.
      const eventId = newMetaEventId();
      const item = cycle === "annual" ? "family_annual" : "family_monthly";
      trackMeta("InitiateCheckout", { value: cents / 100, currency: "USD", content_name: item }, eventId);
      rememberCheckout(cents);
      const data = await call("/api/billing/checkout", "POST", { item, invitationId: p.checkout.invitationId, returnPath: `/v/${p.token}/connect`, ...(eventId ? { metaEventId: eventId } : {}) });
      if (data?.url) window.location.assign(data.url);
    });

  const hasPlan = p.plan === "active";
  const anyChild = p.kids.some((k) => k.approved);
  const steps: { key: string; state: State; title: string; note?: string; body?: React.ReactNode }[] = [];

  steps.push({
    key: "connect",
    state: p.connected ? "done" : "current",
    title: p.connected ? `${p.name} connected` : `Connect ${p.name} to your family`,
    note: p.connected ? `In your Family Circle. No child hears ${p.name} yet.` : undefined,
    body: (
      <>
        <p>{p.name} joins your Family Circle, waiting for your OK. Nobody hears them until you choose.</p>
        <button type="button" className={`${buttonPrimary} w-full sm:w-fit`} disabled={busy} onClick={connect} data-testid="connect-storyteller">
          {busy ? "Connecting…" : `Connect ${p.name} to My Family`}
        </button>
      </>
    ),
  });

  if (p.plan !== "active") {
    steps.push({
      key: "plan",
      state: !p.connected ? "locked" : "current",
      title: p.plan === "starting" ? "Starting Readli Family" : "Start Readli Family",
      note: !p.connected ? `Opens after you connect ${p.name}.` : undefined,
      body:
        p.plan === "starting" ? (
          <PlanStarting />
        ) : p.checkout.paymentsOn ? (
          <>
            {p.checkout.canceled && (
              <p role="status" className="rounded-2xl bg-sunshine/60 p-3 text-sm" data-testid="checkout-canceled">
                Checkout was canceled, so nothing was charged. {p.name} is still in your Family Circle whenever you&apos;re ready.
              </p>
            )}
            <div role="radiogroup" aria-label="How you'd like to pay" className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
              {(["monthly", "annual"] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)} className={`min-h-11 rounded-full font-display font-semibold ${cycle === c ? "bg-ink text-white" : ""}`}>
                  {c === "monthly" ? `Monthly · ${p.checkout.monthly}` : `Yearly · ${p.checkout.annual}`}
                </button>
              ))}
            </div>
            <p className="text-sm" data-testid="billing-disclosure">
              {cycle === "monthly" ? `${p.checkout.monthly} a month` : `${p.checkout.annual} a year`}, charged when you check out, with {p.checkout.monthlyCredits} narration credits every month. Renews{" "}
              {cycle === "monthly" ? "monthly" : "yearly"} until you cancel, which you can do any time in Billing.
            </p>
            <button type="button" className={`${buttonPrimary} w-full sm:w-fit`} disabled={busy} onClick={startCheckout} data-testid="circle-checkout">
              Continue to checkout
            </button>
          </>
        ) : (
          <p className="text-sm" data-testid="payments-off">
            Readli Family memberships aren&apos;t open for purchase yet, so nothing is charged. {p.name} stays in your Family Circle until then.
          </p>
        ),
    });
  }

  const slotFree = p.slotsUsed < p.slotsTotal;
  steps.push({
    key: "slot",
    state: p.active ? "done" : p.connected && hasPlan ? "current" : "locked",
    title: p.active ? `${p.name} is one of your storytellers` : `Activate ${p.name} as a storyteller`,
    note: p.active ? undefined : !p.connected ? `Opens after you connect ${p.name}.` : !hasPlan ? "Opens once your Readli Family plan starts." : undefined,
    body: slotFree ? (
      <>
        <p className="text-sm">
          Uses 1 of your {p.slotsTotal} storyteller slots ({p.slotsUsed} in use). You can swap storytellers later.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonPrimary} disabled={busy || !p.voiceId} onClick={() => run(() => call("/api/family/narrators", "POST", { voiceId: p.voiceId, action: "activate" }))} data-testid="activate-storyteller">
            Activate {p.name}
          </button>
          <Link href="/family" className="font-semibold underline underline-offset-4">
            Decide later
          </Link>
        </div>
      </>
    ) : (
      <div className="flex flex-col gap-3" data-testid="slots-full">
        <p className="text-sm">
          All {p.slotsTotal} storyteller slots are in use. {p.name} stays ready in your Family Circle. Free a slot in Storytellers, or add one.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/family/narrators" className={buttonSecondary}>
            Manage storytellers
          </Link>
          {p.slotsForSale && (
            <Link href="/billing/narrator-slots" className={buttonSecondary} data-testid="add-slot">
              Add a slot · {p.slotPrice} a month
            </Link>
          )}
        </div>
      </div>
    ),
  });

  steps.push({
    key: "children",
    state: anyChild ? "done" : p.active ? "current" : "locked",
    title: anyChild ? `${p.kids.filter((k) => k.approved).map((k) => k.nickname).join(", ")} can hear ${p.name}` : "Choose which children can listen",
    note: anyChild || p.active ? undefined : `Opens after you activate ${p.name}.`,
    body:
      p.kids.length === 0 ? (
        <p>
          Add a child&apos;s profile first.{" "}
          <Link href="/family/kids" className="font-semibold underline underline-offset-4">
            Add a child
          </Link>
        </p>
      ) : (
        <>
          <p className="text-sm">Every switch starts off. Nobody hears {p.name} until you turn them on, and you can change this any time.</p>
          {p.kids.map((k) => (
            <label key={k.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4">
              <span className="font-display text-lg font-semibold">{k.nickname}</span>
              <input
                type="checkbox"
                role="switch"
                className="size-6 accent-coral-deep"
                checked={k.approved}
                disabled={busy}
                onChange={(e) => run(() => call(`/api/family/kids/${k.id}/storytellers`, "PUT", { changes: [{ voiceId: p.voiceId, approved: e.target.checked }] }))}
                aria-label={`${k.nickname} can hear ${p.name}`}
              />
            </label>
          ))}
        </>
      ),
  });

  const title = p.book?.title ?? "a story";
  steps.push({
    key: "story",
    state: anyChild ? "current" : "locked",
    title: `Prepare ${title}`,
    note: anyChild ? undefined : "Opens once at least one child can listen.",
    body: (
      <div className="flex items-center gap-4">
        {p.book?.coverUrl && <Image src={p.book.coverUrl} alt="" width={72} height={96} className="w-16 shrink-0 rounded-xl shadow" />}
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm">Choose the chapters and check the credits first. Nothing is narrated until you tap Prepare.</p>
          <Link
            href={p.book && p.voiceId ? `/family/books/${p.book.slug}?voice=${p.voiceId}&scope=book` : "/family/books"}
            className={`${buttonPrimary} w-full sm:w-fit`}
            data-testid="prepare-book"
          >
            {p.book ? `Prepare ${p.book.title}` : "Choose a story"}
          </Link>
        </div>
      </div>
    ),
  });

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="storyteller-steps">
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <Step key={s.key} n={i + 1} state={s.state} title={s.title} note={s.note} testId={`step-${s.key}`}>
            {s.body}
          </Step>
        ))}
      </ol>
      {error && (
        <p role="alert" className="text-coral-deep">
          {error}
        </p>
      )}
    </div>
  );
}

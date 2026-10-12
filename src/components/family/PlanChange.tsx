"use client";

import { useEffect, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { formatPrice } from "@/lib/family/plan";

export type PlanTarget = "family_monthly" | "family_annual" | "archive_monthly";

interface Preview {
  to: PlanTarget;
  effectiveAt: string;
  timing: "now" | "period_end" | "trial_end";
  keepsTrial: boolean;
  endsTrial: boolean;
  dueNowCents: number;
  creditCents: number;
  nextAmountCents: number;
  nextBillingAt: string | null;
  prorationDate: number | null;
}

const NAMES: Record<PlanTarget, string> = { family_monthly: "Readli Family, monthly", family_annual: "Readli Family, yearly", archive_monthly: "the Family Archive" };
const PER: Record<PlanTarget, string> = { family_monthly: "a month", family_annual: "a year", archive_monthly: "a month" };
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "long" });

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await fetch("/api/billing/change-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

const problem = (json: Record<string, unknown>) => ((json.error as { message?: string } | undefined)?.message as string | undefined) ?? "Something went wrong. Please try again.";

/**
 * Confirming a plan change (Kevin, 2026-10-12): the customer sees when it takes effect, any adjustment
 * for unused time and what they'll pay, before anything changes. Downgrades default to the end of the
 * term already paid for, with switching now as a choice. During a trial, choosing monthly or yearly
 * keeps the trial; starting to pay early needs its own confirmation.
 */
export function PlanChangeConfirm(props: { to: PlanTarget; downgrade: boolean; inTrial: boolean; onDone: (message: string) => void; onCancel: () => void }) {
  const [timing, setTiming] = useState<"period_end" | "now">("period_end");
  const [endTrial, setEndTrial] = useState(false);
  const [trialOk, setTrialOk] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canEndTrial = props.inTrial && !props.downgrade;
  const canSwitchNow = props.downgrade && !props.inTrial;

  useEffect(() => {
    let live = true;
    setPreview(null);
    setError("");
    void post({ to: props.to, step: "preview", timing, endTrial }).then(({ ok, json }) => {
      if (!live) return;
      if (ok) setPreview(json.preview as Preview);
      else setError(problem(json));
    });
    return () => {
      live = false;
    };
  }, [props.to, timing, endTrial]);

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    setError("");
    const { ok, json } = await post({ to: props.to, step: "confirm", timing, endTrial, trialEndConfirmed: endTrial && trialOk, prorationDate: preview.prorationDate });
    setBusy(false);
    if (!ok) return setError(problem(json));
    props.onDone(
      json.kind === "scheduled"
        ? `Done. You'll move to ${NAMES[props.to]} on ${day(preview.effectiveAt)}. Until then nothing changes, and you can cancel the switch here.`
        : preview.keepsTrial
          ? `Done. Your free trial carries on until ${preview.nextBillingAt ? day(preview.nextBillingAt) : "it ends"}, then ${NAMES[props.to]} starts.`
          : `Done. Your plan updates as soon as Stripe confirms the change${json.pending ? " and your payment goes through" : ""}.`,
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-sunshine/30 p-4" data-testid="plan-change-confirm">
      <p className="font-semibold">Switch to {NAMES[props.to]}?</p>
      {canSwitchNow && (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="sr-only">When</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="timing" checked={timing === "period_end"} onChange={() => setTiming("period_end")} className="mt-1" />
            <span>At the end of the time you&apos;ve already paid for (you keep everything until then)</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="timing" checked={timing === "now"} onChange={() => setTiming("now")} className="mt-1" />
            <span>Now, with your unused time added to your account as credit for future bills</span>
          </label>
        </fieldset>
      )}
      {canEndTrial && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={endTrial} onChange={(e) => { setEndTrial(e.target.checked); setTrialOk(false); }} className="mt-1" />
          <span>Start paying now instead of when my free trial ends</span>
        </label>
      )}
      {!preview && !error && <p className="text-sm">Working out the details…</p>}
      {preview && (
        <ul className="flex flex-col gap-1 text-sm" data-testid="plan-change-preview">
          <li>
            <span className="font-semibold">Takes effect:</span> {preview.timing === "now" ? "now" : day(preview.effectiveAt)}
            {preview.timing === "trial_end" ? ", when your free trial ends" : preview.timing === "period_end" ? ", at the end of your current billing period" : ""}
          </li>
          {preview.keepsTrial && <li>Your free trial isn&apos;t shortened. Nothing is charged until it ends.</li>}
          {preview.creditCents > 0 && (
            <li>
              <span className="font-semibold">Credit for unused time:</span> {formatPrice(preview.creditCents)}, kept on your account and used for your next bills. It
              isn&apos;t paid out in cash; if your plan ends with credit left, it stays on your account for when you come back.
            </li>
          )}
          <li>
            <span className="font-semibold">Charged today:</span> {formatPrice(preview.dueNowCents)}
          </li>
          <li>
            <span className="font-semibold">Then:</span> {formatPrice(preview.nextAmountCents)} {PER[props.to]}
            {preview.nextBillingAt ? `, first billed on ${day(preview.nextBillingAt)}` : ""}
          </li>
        </ul>
      )}
      {preview?.endsTrial && (
        <label className="flex items-start gap-2 rounded-2xl bg-coral/15 p-3 text-sm">
          <input type="checkbox" checked={trialOk} onChange={(e) => setTrialOk(e.target.checked)} className="mt-1" />
          <span>I understand my free trial ends today and my card is charged {formatPrice(preview.dueNowCents)} now.</span>
        </label>
      )}
      {error && <p role="alert" className="rounded-2xl bg-coral/30 p-3 text-sm">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonPrimary} disabled={busy || !preview || (preview.endsTrial && !trialOk)} onClick={() => void confirm()}>
          Confirm the switch
        </button>
        <button type="button" className={buttonSecondary} disabled={busy} onClick={props.onCancel}>
          Keep my current plan
        </button>
      </div>
    </div>
  );
}

/** A switch already scheduled for the end of the paid term or trial, with a way to call it off. */
export function ScheduledPlanChange({ paymentsOn }: { paymentsOn: boolean }) {
  const [scheduled, setScheduled] = useState<{ to: PlanTarget | null; effectiveAt: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!paymentsOn) return;
    let live = true;
    fetch("/api/billing/change-plan", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ scheduled: typeof scheduled }>) : null))
      .then((body) => live && setScheduled(body?.scheduled ?? null))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [paymentsOn]);
  if (!scheduled) return null;
  const cancel = async () => {
    const res = await fetch("/api/billing/change-plan", { method: "DELETE" });
    if (res.ok) setScheduled(null);
    else setError(problem((await res.json().catch(() => ({}))) as Record<string, unknown>));
  };
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-ivory p-3 text-sm ring-2 ring-ink/10" data-testid="scheduled-plan-change">
      <p>
        You&apos;re switching to {scheduled.to ? NAMES[scheduled.to] : "a new plan"} on {day(scheduled.effectiveAt)}. You keep your current plan until then.
      </p>
      <button type="button" className="self-start font-semibold underline underline-offset-4" onClick={() => void cancel()}>
        Cancel the switch
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

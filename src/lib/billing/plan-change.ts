import type { Params, StripeInvoicePreview, StripeSchedule, StripeSubscription } from "./stripe-api";

/**
 * Readli's own plan-change flow for Stripe subscriptions (Kevin, 2026-10-11, decision 5, and his answers
 * of 2026-10-12): Readli Family monthly ↔ yearly, and Readli Family ↔ the Family Archive. The billing
 * portal still handles cards, extra slots and cancelling. Readli never changes the household's plan
 * here: it asks Stripe to change the subscription, and the plan changes when Stripe's subscription
 * event arrives at the webhook. The customer always sees a preview (effective date, any adjustment and
 * the resulting amount) and confirms before anything changes.
 *
 * - Upgrades (Archive → Family, monthly → yearly) take effect now and are invoiced at once with
 *   proration; with payment_behavior "pending_if_incomplete", a failed payment leaves the
 *   subscription as it was.
 * - Downgrades (Family → Archive, yearly → monthly) are scheduled for the end of the term already
 *   paid for, so paid Family benefits are never removed early. The customer may instead choose to
 *   switch now: Stripe then credits the unused part of the period to the customer's balance, which
 *   pays future invoices. No cash refund is issued automatically; credit left when the subscription
 *   ends goes to the admin queue (credit-review.ts), so it is never silently forfeited.
 * - During a free trial: switching between monthly and yearly keeps the trial; a downgrade to the
 *   Archive waits until the trial ends; ending the trial early to start paying needs the customer's
 *   explicit confirmation. A trial is never shortened silently.
 * - Moving to the Archive removes extra storyteller slots (the Archive has none).
 * - Nothing in the family's library, kids profiles or permissions is touched by any of this.
 */
export type PlanTarget = "family_monthly" | "family_annual" | "archive_monthly";
export type ChangeTiming = "now" | "period_end";

const PREFIX: Record<PlanTarget, string> = {
  family_monthly: "readli_family_monthly_",
  family_annual: "readli_family_annual_",
  archive_monthly: "readli_archive_monthly_",
};
const SLOT_PREFIX = "readli_extra_slot_";

const RANK: Record<PlanTarget, number> = { archive_monthly: 0, family_monthly: 1, family_annual: 2 };

export function currentTarget(sub: StripeSubscription): PlanTarget | null {
  for (const item of sub.items.data) {
    const key = item.price.lookup_key ?? "";
    for (const [target, prefix] of Object.entries(PREFIX) as [PlanTarget, string][]) if (key.startsWith(prefix)) return target;
  }
  return null;
}

/** The end of the period already paid for (newer Stripe API versions keep it on the items). */
export function periodEnd(sub: StripeSubscription): number | null {
  const ends = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === "number");
  return sub.current_period_end ?? (ends.length ? Math.max(...ends) : null);
}

export const inTrial = (sub: StripeSubscription, nowSeconds: number) => sub.status === "trialing" && (sub.trial_end ?? 0) > nowSeconds;

export type PlanChangeRefusal = "no_plan_item" | "same_plan" | "not_active" | "has_slots" | "no_period_end" | "trial_end_unconfirmed";

export interface PlanChangeRequest {
  to: PlanTarget;
  /** Downgrades only: "period_end" (the default) or "now" with unused time credited. */
  timing?: ChangeTiming;
  /** During a trial: start paying now. Needs trialEndConfirmed, after the customer saw the preview. */
  endTrial?: boolean;
  trialEndConfirmed?: boolean;
}

interface Base {
  from: PlanTarget;
  to: PlanTarget;
  upgrade: boolean;
  /** Unix seconds when the new plan starts. */
  effectiveAt: number;
  keepsTrial: boolean;
  endsTrial: boolean;
}

/** A change Stripe applies to the subscription now. */
export type ImmediateChange = Base & { ok: true; kind: "now"; yearlyChange: boolean; params: Params };
/** A change Stripe applies at effectiveAt through a subscription schedule. */
export type ScheduledChange = Base & { ok: true; kind: "scheduled"; current: Params[]; next: Params[]; trialEnd: number | null; metadata: Record<string, string> };
export type PlanChange = ImmediateChange | ScheduledChange | { ok: false; reason: PlanChangeRefusal };

export function planChange(sub: StripeSubscription, req: PlanChangeRequest, priceId: string, nowSeconds: number): PlanChange {
  const { to } = req;
  if (!["active", "trialing", "past_due"].includes(sub.status)) return { ok: false, reason: "not_active" };
  const from = currentTarget(sub);
  if (!from) return { ok: false, reason: "no_plan_item" };
  if (from === to) return { ok: false, reason: "same_plan" };
  const planItem = sub.items.data.find((i) => (i.price.lookup_key ?? "").startsWith(PREFIX[from]))!;
  const slots = sub.items.data.filter((i) => (i.price.lookup_key ?? "").startsWith(SLOT_PREFIX));
  // Extra slots bill monthly; Stripe can't mix monthly and yearly items in one subscription.
  if (to === "family_annual" && slots.length) return { ok: false, reason: "has_slots" };
  const upgrade = RANK[to] > RANK[from];
  const yearlyChange = (from === "family_annual") !== (to === "family_annual");
  const trial = inTrial(sub, nowSeconds);
  const items: Params[] = [{ id: planItem.id, price: priceId, quantity: 1 }];
  if (to === "archive_monthly") for (const s of slots) items.push({ id: s.id, deleted: true });

  const scheduled = (effectiveAt: number): ScheduledChange => ({
    ok: true,
    kind: "scheduled",
    from,
    to,
    upgrade,
    effectiveAt,
    keepsTrial: trial,
    endsTrial: false,
    trialEnd: trial ? sub.trial_end! : null,
    metadata: sub.metadata ?? {},
    current: sub.items.data.map((i) => ({ price: i.price.id, quantity: i.quantity ?? 1 })),
    next: [{ price: priceId, quantity: 1 }, ...(to === "archive_monthly" ? [] : slots.map((s) => ({ price: s.price.id, quantity: s.quantity ?? 1 })))],
  });

  if (trial) {
    // A downgrade waits for the trial to end; the trial itself is untouched.
    if (to === "archive_monthly") return scheduled(sub.trial_end!);
    if (req.endTrial) {
      if (!req.trialEndConfirmed) return { ok: false, reason: "trial_end_unconfirmed" };
      return {
        ok: true,
        kind: "now",
        from,
        to,
        upgrade,
        yearlyChange,
        effectiveAt: nowSeconds,
        keepsTrial: false,
        endsTrial: true,
        params: { items, trial_end: "now", proration_behavior: "none", payment_behavior: "pending_if_incomplete" },
      };
    }
    // Choosing monthly or yearly for after the trial: nothing is charged and the trial end stays.
    return {
      ok: true,
      kind: "now",
      from,
      to,
      upgrade,
      yearlyChange,
      effectiveAt: nowSeconds,
      keepsTrial: true,
      endsTrial: false,
      params: { items, trial_end: sub.trial_end!, proration_behavior: "none", metadata: { ...(sub.metadata ?? {}), last_plan_change: `${from}->${to}` } },
    };
  }

  if (!upgrade && (req.timing ?? "period_end") === "period_end") {
    const end = periodEnd(sub);
    if (!end) return { ok: false, reason: "no_period_end" };
    return scheduled(end);
  }
  return {
    ok: true,
    kind: "now",
    from,
    to,
    upgrade,
    yearlyChange,
    effectiveAt: nowSeconds,
    keepsTrial: false,
    endsTrial: false,
    params: {
      items,
      proration_behavior: upgrade ? "always_invoice" : "create_prorations",
      ...(upgrade ? { payment_behavior: "pending_if_incomplete" } : {}),
      ...(yearlyChange ? { billing_cycle_anchor: "now" } : {}),
      // Stripe accepts only item and billing changes alongside pending_if_incomplete.
      ...(upgrade ? {} : { metadata: { ...(sub.metadata ?? {}), last_plan_change: `${from}->${to}` } }),
    },
  };
}

/**
 * The phases for a scheduled change: the current items until effectiveAt (keeping any trial), then the
 * new plan. The schedule releases the subscription afterwards, so it carries on as a normal one. Phase
 * metadata replaces the subscription's, so both phases carry it whole (the webhook finds the household
 * through it).
 */
export function schedulePhases(schedule: StripeSchedule, change: ScheduledChange): Params {
  const start = schedule.phases[0]?.start_date ?? schedule.current_phase?.start_date;
  return {
    end_behavior: "release",
    phases: [
      { items: change.current, start_date: start, end_date: change.effectiveAt, proration_behavior: "none", metadata: change.metadata, ...(change.trialEnd ? { trial_end: change.trialEnd } : {}) },
      { items: change.next, proration_behavior: "none", metadata: { ...change.metadata, last_plan_change: `${change.from}->${change.to}` } },
    ],
  };
}

/** Stripe's preview parameters for a change applied now (invoices/create_preview). */
export function previewParams(sub: StripeSubscription, change: ImmediateChange, prorationDate: number): Params {
  const p = change.params;
  return {
    customer: sub.customer,
    subscription: sub.id,
    subscription_details: {
      items: p.items as Params[],
      proration_behavior: p.proration_behavior as string,
      proration_date: prorationDate,
      ...(p.billing_cycle_anchor ? { billing_cycle_anchor: p.billing_cycle_anchor as string } : {}),
      ...(p.trial_end !== undefined ? { trial_end: p.trial_end as string | number } : {}),
    },
  };
}

export interface PlanChangePreview {
  from: PlanTarget;
  to: PlanTarget;
  /** ISO time the new plan starts. */
  effectiveAt: string;
  timing: "now" | "period_end" | "trial_end";
  keepsTrial: boolean;
  endsTrial: boolean;
  /** Charged to the card when confirmed. */
  dueNowCents: number;
  /** Credit for unused time, kept on the account to pay future bills (never a silent forfeit). */
  creditCents: number;
  /** The new plan's regular amount, and when it is first billed. */
  nextAmountCents: number;
  nextBillingAt: string | null;
  /** Pass back on confirm so Stripe prorates to the same second the preview used. */
  prorationDate: number | null;
}

const isProration = (line: StripeInvoicePreview["lines"]["data"][number]) => Boolean(line.proration ?? line.parent?.subscription_item_details?.proration);
const iso = (s: number) => new Date(s * 1000).toISOString();

/**
 * What the customer sees before confirming. A scheduled change costs nothing now and bills the new
 * price from its start; a change applied now uses Stripe's own invoice preview for the adjustment.
 */
export function describeChange(
  sub: StripeSubscription,
  change: ImmediateChange | ScheduledChange,
  newPriceCents: number,
  invoice: StripeInvoicePreview | null,
  prorationDate: number | null,
  nowSeconds: number,
): PlanChangePreview {
  const base = { from: change.from, to: change.to, keepsTrial: change.keepsTrial, endsTrial: change.endsTrial, nextAmountCents: newPriceCents };
  if (change.kind === "scheduled") {
    return { ...base, effectiveAt: iso(change.effectiveAt), timing: change.trialEnd ? "trial_end" : "period_end", dueNowCents: 0, creditCents: 0, nextBillingAt: iso(change.effectiveAt), prorationDate: null };
  }
  if (change.keepsTrial) {
    return { ...base, effectiveAt: iso(nowSeconds), timing: "now", dueNowCents: 0, creditCents: 0, nextBillingAt: sub.trial_end ? iso(sub.trial_end) : null, prorationDate: null };
  }
  const lines = invoice?.lines.data ?? [];
  const proration = lines.filter(isProration).reduce((n, l) => n + l.amount, 0);
  // Upgrades, yearly switches and ending a trial are invoiced at once; other downgrades carry their credit to the next bill.
  const invoicedNow = change.upgrade || change.yearlyChange || change.endsTrial;
  const total = invoice?.total ?? 0;
  // A new billing date starts with a yearly switch or a paid start: the new plan line's period ends there.
  const renewal = lines.find((l) => !isProration(l))?.period?.end ?? null;
  const end = change.yearlyChange || change.endsTrial ? renewal : periodEnd(sub);
  const nextBillingAt = end ? iso(end) : null;
  return {
    ...base,
    effectiveAt: iso(nowSeconds),
    timing: "now",
    dueNowCents: invoicedNow ? Math.max(0, invoice?.amount_due ?? 0) : 0,
    creditCents: invoicedNow ? Math.max(0, -total) : Math.max(0, -proration),
    nextBillingAt,
    prorationDate,
  };
}

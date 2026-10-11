import type { CreditDraw, CreditLot, CreditSource, FamilyState, HouseholdEntitlement } from "@/lib/family/model";
import { familyEntitlement } from "@/lib/family/permissions";
import type { PlanConfig } from "@/lib/family/plan";

/**
 * Readli credits (Kevin's pricing, 2026-10-11). One credit pays for `plan.charactersPerCredit`
 * (1,000) characters of new narration. Every balance, lot, reservation and ledger row is kept in
 * exact characters ("units"); whole or decimal credits are only for display. Each household spends
 * from lots: this billing month's included credits (derived from the plan, so an admin change applies
 * at once; annual plans refresh monthly too), trial credits, promotional grants and purchased packs.
 * Included and trial credits go first, then promotional, then purchased; within a source, the lot
 * that expires soonest. Each source stays separate on every lot and ledger row. Only Readli Family
 * makes new stories, so the Family Archive has no included credits (its stored lots wait for a return).
 */

/** Characters in one Readli credit. */
export function unitsPerCredit(plan: PlanConfig): number {
  return plan.charactersPerCredit;
}

/** Units for a whole number of credits (packs, allowances, grants). */
export function creditUnits(credits: number, plan: PlanConfig): number {
  return Math.round(credits * plan.charactersPerCredit);
}

/** Units as credits for display, to one decimal place (12,340 units = 12.3 credits). */
export function displayCredits(units: number, perCredit = 1000): number {
  return Math.round((units / perCredit) * 10) / 10;
}

/** Same date `months` later in UTC, clamped to the end of a shorter month (Jan 31 + 1 = Feb 28). */
export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last));
  return t.toISOString();
}

/** Start of the billing month containing `at`, counted from the plan's start date. */
export function cycleStart(anchor: string, at: string): string {
  const a = new Date(anchor);
  const b = new Date(at);
  let k = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  while (k > 0 && addMonths(anchor, k) > at) k -= 1;
  return addMonths(anchor, Math.max(0, k));
}

export function allowanceUnits(plan: PlanConfig): number {
  return creditUnits(plan.monthlyCredits, plan);
}

/** Units for one sentence: its exact characters. What's quoted is what's reserved and charged. */
export function creditsFor(characters: number): number {
  return Math.max(1, characters);
}

/** A trial plan, or a paid subscription still in its free trial: trial credits, not monthly ones. */
export function inTrial(e: HouseholdEntitlement, at: string): boolean {
  return e.source === "trial" || Boolean(e.trialEndsAt && at < e.trialEndsAt);
}

/** The plan's trial credits, unless this plan has its own number (0 when withheld for a reused trial card). */
export const trialCreditsOf = (e: HouseholdEntitlement, plan: PlanConfig) => (typeof e.trialCredits === "number" ? e.trialCredits : plan.trialCredits);

/** When paid billing months start counting: after a subscription's free trial, if it had one. */
const billingAnchor = (e: HouseholdEntitlement) => (e.trialEndsAt && e.trialEndsAt > e.startsAt ? e.trialEndsAt : e.startsAt);

/** The included lot for this billing month, or the trial lot, for a household on Readli Family. */
export function includedLotId(state: FamilyState, householdId: string, at: string): string | null {
  const e = familyEntitlement(state, householdId, at);
  if (!e) return null;
  return inTrial(e, at) ? `trial:${e.id}` : `subscription:${e.id}:${cycleStart(billingAnchor(e), at).slice(0, 10)}`;
}

/** Included lots that can still be spent at `at` (this billing month, plus rollover months). */
function subscriptionLots(state: FamilyState, plan: PlanConfig, householdId: string, at: string): CreditLot[] {
  const entitlement = familyEntitlement(state, householdId, at);
  if (!entitlement) return [];
  if (inTrial(entitlement, at)) {
    // One allowance for the whole trial (14 days, 10 credits by default), kept apart from paid credits.
    return [
      {
        id: `trial:${entitlement.id}`,
        householdId,
        source: "trial",
        credits: creditUnits(trialCreditsOf(entitlement, plan), plan),
        grantedAt: entitlement.startsAt,
        expiresAt: entitlement.source === "trial" ? entitlement.endsAt : entitlement.trialEndsAt!,
        note: "Free trial credits",
      },
    ];
  }
  const units = allowanceUnits(plan);
  const anchor = billingAnchor(entitlement);
  const current = cycleStart(anchor, at);
  const lots: CreditLot[] = [];
  for (let back = plan.subscriptionRolloverMonths; back >= 0; back -= 1) {
    const start = addMonths(current, -back);
    if (start < anchor) continue;
    lots.push({
      id: `subscription:${entitlement.id}:${start.slice(0, 10)}`,
      householdId,
      source: "subscription",
      credits: units,
      grantedAt: start,
      expiresAt: addMonths(start, plan.subscriptionRolloverMonths + 1),
      note: back === 0 ? "This month's Readli Family credits" : `Rolled over from ${start.slice(0, 10)}`,
    });
  }
  return lots;
}

export interface LotBalance {
  lot: CreditLot;
  /** Reserved and not refunded (includes credits held for narration being prepared). */
  used: number;
  /** Committed by finished narration. */
  committed: number;
  left: number;
}

const ORDER: Record<CreditSource, number> = { subscription: 0, trial: 0, promotional: 1, purchased: 2 };

/** Spendable lots in spending order. Expired lots are left out. */
export function spendableLots(state: FamilyState, plan: PlanConfig, householdId: string, at: string): LotBalance[] {
  const lots = [...subscriptionLots(state, plan, householdId, at), ...state.creditLots.filter((l) => l.householdId === householdId)];
  return lots
    .filter((l) => l.grantedAt <= at && (l.expiresAt === null || l.expiresAt > at))
    .map((lot) => {
      const rows = state.ledger.filter((e) => e.lotId === lot.id && e.householdId === householdId);
      const sum = (kind: string) => rows.filter((e) => e.kind === kind).reduce((n, e) => n + e.credits, 0);
      const used = sum("reserve") - sum("refund");
      return { lot, used, committed: sum("commit"), left: Math.max(0, lot.credits - used) };
    })
    .sort((a, b) => ORDER[a.lot.source] - ORDER[b.lot.source] || (a.lot.expiresAt ?? "9999").localeCompare(b.lot.expiresAt ?? "9999"));
}

/** Takes `credits` units from the lots in spending order, mutating their `left`. Null if they don't cover it. */
export function draw(lots: LotBalance[], credits: number): CreditDraw[] | null {
  if (lots.reduce((n, l) => n + l.left, 0) < credits) return null;
  const out: CreditDraw[] = [];
  let need = credits;
  for (const l of lots) {
    if (need === 0) break;
    const take = Math.min(l.left, need);
    if (take > 0) {
      out.push({ lotId: l.lot.id, credits: take });
      l.left -= take;
      need -= take;
    }
  }
  return out;
}

export interface CreditBalance {
  /** All amounts are in units (characters); divide by `unitsPerCredit` for credits. */
  available: number;
  bySource: Record<CreditSource, number>;
  /** Units set aside for narration still being prepared. */
  held: number;
  /** Units used by finished narration this billing month. */
  usedThisPeriod: number;
  allowance: number;
  /** When this billing month's included credits are replaced by the next month's. */
  renewsAt: string | null;
  unitsPerCredit: number;
  lots: { id: string; source: CreditSource; left: number; credits: number; expiresAt: string | null; note: string }[];
}

export function creditBalance(state: FamilyState, plan: PlanConfig, householdId: string, at = new Date().toISOString()): CreditBalance {
  const lots = spendableLots(state, plan, householdId, at);
  const bySource: Record<CreditSource, number> = { subscription: 0, trial: 0, promotional: 0, purchased: 0 };
  for (const l of lots) bySource[l.lot.source] += l.left;
  const entitlement = familyEntitlement(state, householdId, at);
  const trial = entitlement ? inTrial(entitlement, at) : false;
  const since = entitlement && !trial ? cycleStart(billingAnchor(entitlement), at) : (entitlement?.startsAt ?? at);
  const mine = state.ledger.filter((e) => e.householdId === householdId);
  const sum = (kind: string, f: (e: (typeof mine)[number]) => boolean = () => true) => mine.filter((e) => e.kind === kind && f(e)).reduce((n, e) => n + e.credits, 0);
  const held = sum("reserve") - sum("refund") - sum("commit");
  return {
    available: lots.reduce((n, l) => n + l.left, 0),
    bySource,
    held: Math.max(0, held),
    usedThisPeriod: sum("commit", (e) => e.at >= since),
    allowance: !entitlement ? 0 : trial ? creditUnits(trialCreditsOf(entitlement, plan), plan) : allowanceUnits(plan),
    renewsAt: !entitlement || trial ? null : addMonths(cycleStart(billingAnchor(entitlement), at), 1),
    unitsPerCredit: unitsPerCredit(plan),
    lots: lots.map((l) => ({ id: l.lot.id, source: l.lot.source, left: l.left, credits: l.lot.credits, expiresAt: l.lot.expiresAt, note: l.lot.note })),
  };
}

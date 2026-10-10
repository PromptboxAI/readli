import type { CreditDraw, CreditLot, CreditSource, FamilyState } from "@/lib/family/model";
import { activeEntitlement } from "@/lib/family/permissions";
import type { PlanConfig } from "@/lib/family/plan";
import { estimateSeconds } from "./costs";

/**
 * Readli credits. One credit pays for `plan.secondsPerCredit` seconds of new narration. Each
 * household spends from lots: this month's subscription allowance (derived from the plan, so the
 * admin setting applies at once), promotional grants and purchased packs. Credits are spent from the
 * lot that expires soonest; ties go promotional, then subscription, then purchased.
 */

export function periodOf(at: string): string {
  return at.slice(0, 7);
}

/** First instant of the month after `period` (YYYY-MM), as an ISO string. */
export function periodEnd(period: string, extraMonths = 0): string {
  const [y, m] = period.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m + extraMonths, 1)).toISOString();
}

function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 7);
}

export function allowanceCredits(plan: PlanConfig): number {
  return Math.floor((plan.monthlyNarrationMinutes * 60) / plan.secondsPerCredit);
}

/** Credits for one sentence: the model's duration estimate plus the quote safety margin. */
export function creditsFor(characters: number, plan: PlanConfig): number {
  return Math.max(1, Math.ceil((estimateSeconds(characters, plan.narrationModelId) * (1 + plan.quoteSafetyMargin)) / plan.secondsPerCredit));
}

/** Credits a finished segment actually used, from its real duration. */
export function creditsUsed(durationMs: number, plan: PlanConfig): number {
  return Math.max(1, Math.ceil(durationMs / 1000 / plan.secondsPerCredit));
}

/** Subscription lots that can still be spent at `at` (this month, plus rollover months). */
function subscriptionLots(state: FamilyState, plan: PlanConfig, householdId: string, at: string): CreditLot[] {
  const entitlement = activeEntitlement(state, householdId, at);
  if (!entitlement) return [];
  if (entitlement.source === "trial") {
    // One allowance for the whole trial, not per calendar month.
    return [
      {
        id: `trial:${entitlement.id}`,
        householdId,
        source: "subscription",
        credits: Math.floor((plan.trialNarrationMinutes * 60) / plan.secondsPerCredit),
        grantedAt: entitlement.startsAt,
        expiresAt: entitlement.endsAt,
        note: "Free trial credits",
      },
    ];
  }
  const credits = allowanceCredits(plan);
  const current = periodOf(at);
  const lots: CreditLot[] = [];
  for (let back = plan.subscriptionRolloverMonths; back >= 0; back -= 1) {
    const period = shiftPeriod(current, -back);
    lots.push({
      id: `subscription:${period}`,
      householdId,
      source: "subscription",
      credits,
      grantedAt: `${period}-01T00:00:00.000Z`,
      expiresAt: periodEnd(period, plan.subscriptionRolloverMonths),
      note: back === 0 ? "This month's Readli Family credits" : `Rolled over from ${period}`,
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

const ORDER: Record<CreditSource, number> = { promotional: 0, subscription: 1, purchased: 2 };

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
    .sort((a, b) => (a.lot.expiresAt ?? "9999") .localeCompare(b.lot.expiresAt ?? "9999") || ORDER[a.lot.source] - ORDER[b.lot.source]);
}

/** Takes `credits` from the lots in spending order, mutating their `left`. Null if they don't cover it. */
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
  available: number;
  bySource: Record<CreditSource, number>;
  /** Credits set aside for narration still being prepared. */
  held: number;
  /** Credits used by finished narration this month. */
  usedThisPeriod: number;
  allowance: number;
  /** When this month's subscription credits are replaced by next month's. */
  renewsAt: string | null;
  secondsPerCredit: number;
  lots: { id: string; source: CreditSource; left: number; credits: number; expiresAt: string | null; note: string }[];
}

export function creditBalance(state: FamilyState, plan: PlanConfig, householdId: string, at = new Date().toISOString()): CreditBalance {
  const lots = spendableLots(state, plan, householdId, at);
  const bySource: Record<CreditSource, number> = { subscription: 0, promotional: 0, purchased: 0 };
  for (const l of lots) bySource[l.lot.source] += l.left;
  const period = periodOf(at);
  const mine = state.ledger.filter((e) => e.householdId === householdId);
  const sum = (kind: string, f: (e: (typeof mine)[number]) => boolean = () => true) => mine.filter((e) => e.kind === kind && f(e)).reduce((n, e) => n + e.credits, 0);
  const held = sum("reserve") - sum("refund") - sum("commit");
  const entitlement = activeEntitlement(state, householdId, at);
  return {
    available: lots.reduce((n, l) => n + l.left, 0),
    bySource,
    held: Math.max(0, held),
    usedThisPeriod: sum("commit", (e) => periodOf(e.at) === period),
    allowance: !entitlement ? 0 : entitlement.source === "trial" ? Math.floor((plan.trialNarrationMinutes * 60) / plan.secondsPerCredit) : allowanceCredits(plan),
    renewsAt: !entitlement ? null : entitlement.source === "trial" ? null : periodEnd(period),
    secondsPerCredit: plan.secondsPerCredit,
    lots: lots.map((l) => ({ id: l.lot.id, source: l.lot.source, left: l.left, credits: l.lot.credits, expiresAt: l.lot.expiresAt, note: l.lot.note })),
  };
}

/** Credits rounded to whole minutes of narration, for friendly copy. */
export function creditMinutes(credits: number, plan: PlanConfig): number {
  return Math.round(((credits * plan.secondsPerCredit) / 60) * 10) / 10;
}

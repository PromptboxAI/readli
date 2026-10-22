import type { FamilyState, PlanTier } from "@/lib/family/model";
import { activeEntitlement, tierOf } from "@/lib/family/permissions";
import type { PlanConfig } from "@/lib/family/plan";

/** What a parent sees about their household's plan on the billing page. */
export interface BillingSummary {
  plan: "none" | "trial" | "subscription" | "gift" | "donated" | "tester";
  /** Readli Family, or the Family Archive (keeps and plays stories; no new ones). */
  tier: PlanTier | null;
  /** Last day of access when the plan has an end (trial, gift, or a canceled subscription). */
  endsAt: string | null;
  /** When a paid subscription's free trial ends. */
  trialEndsAt: string | null;
  narratorSlots: number;
  extraNarratorSlots: number;
  /** Monthly extra-slot charge on a paid plan, at today's price. */
  extraSlotsMonthlyCents: number;
  /** Whether this family can start a paid plan (no plan, or only a trial or tester plan). */
  canStartPlan: boolean;
  /** How this family moves between Readli Family and the Archive: here, through Readli's Stripe plan change, or not yet. */
  tierChange: "direct" | "stripe" | null;
  /** How often a Stripe subscription bills, when known. */
  billingInterval: "month" | "year" | null;
  archiveMonthlyPriceCents: number;
  /** After paid access ends: when it ended and when the stories are scheduled to be deleted. Nothing streams meanwhile. */
  recovery: { endedAt: string; deletesAt: string } | null;
}

const DAY = 86_400_000;

export function billingSummary(state: FamilyState, plan: PlanConfig, householdId: string, at = new Date().toISOString()): BillingSummary {
  const e = activeEntitlement(state, householdId, at);
  if (!e) {
    // Paid access ended: the recovery window runs from the latest end.
    const ended = state.entitlements
      .filter((x) => x.householdId === householdId && x.startsAt <= at)
      .map((x) => (x.endsAt && x.endsAt <= at ? x.endsAt : x.status === "canceled" ? (x.endsAt ?? x.startsAt) : null))
      .filter((x): x is string => Boolean(x))
      .sort()
      .at(-1);
    const recovery = ended ? { endedAt: ended, deletesAt: new Date(Date.parse(ended) + plan.recoveryDays * DAY).toISOString() } : null;
    return {
      plan: "none",
      tier: null,
      endsAt: null,
      trialEndsAt: null,
      narratorSlots: 0,
      extraNarratorSlots: 0,
      extraSlotsMonthlyCents: 0,
      canStartPlan: true,
      tierChange: null,
      billingInterval: null,
      archiveMonthlyPriceCents: plan.archiveMonthlyPriceCents,
      recovery: recovery && recovery.deletesAt > at ? recovery : null,
    };
  }
  const tier = tierOf(e);
  const direct = e.source === "tester" || plan.simulatedCheckout;
  return {
    plan: e.source,
    tier,
    endsAt: e.endsAt,
    trialEndsAt: e.trialEndsAt && e.trialEndsAt > at ? e.trialEndsAt : null,
    narratorSlots: tier === "family" ? plan.includedNarratorSlots + e.extraNarratorSlots : 0,
    extraNarratorSlots: tier === "family" ? e.extraNarratorSlots : 0,
    extraSlotsMonthlyCents: e.source === "subscription" && tier === "family" ? e.extraNarratorSlots * plan.extraSlotPriceCents : 0,
    canStartPlan: e.source === "trial" || e.source === "tester",
    tierChange: direct ? "direct" : e.source === "subscription" ? "stripe" : null,
    billingInterval: e.billingInterval ?? null,
    archiveMonthlyPriceCents: plan.archiveMonthlyPriceCents,
    recovery: null,
  };
}

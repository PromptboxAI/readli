import type { FamilyState } from "@/lib/family/model";
import { activeEntitlement } from "@/lib/family/permissions";
import type { PlanConfig } from "@/lib/family/plan";

/** What a parent sees about their household's plan on the billing page. */
export interface BillingSummary {
  plan: "none" | "trial" | "subscription" | "gift" | "donated" | "tester";
  /** Last day of access when the plan has an end (trial, gift, or a canceled subscription). */
  endsAt: string | null;
  narratorSlots: number;
  extraNarratorSlots: number;
  /** Monthly extra-slot charge on a paid plan, at today's price. */
  extraSlotsMonthlyCents: number;
  /** Whether this family can start a paid plan (no plan, or only a trial or tester plan). */
  canStartPlan: boolean;
}

export function billingSummary(state: FamilyState, plan: PlanConfig, householdId: string, at = new Date().toISOString()): BillingSummary {
  const e = activeEntitlement(state, householdId, at);
  if (!e) {
    return { plan: "none", endsAt: null, narratorSlots: 0, extraNarratorSlots: 0, extraSlotsMonthlyCents: 0, canStartPlan: true };
  }
  return {
    plan: e.source,
    endsAt: e.endsAt,
    narratorSlots: plan.includedNarratorSlots + e.extraNarratorSlots,
    extraNarratorSlots: e.extraNarratorSlots,
    extraSlotsMonthlyCents: e.source === "subscription" ? e.extraNarratorSlots * plan.extraSlotPriceCents : 0,
    canStartPlan: e.source === "trial" || e.source === "tester",
  };
}

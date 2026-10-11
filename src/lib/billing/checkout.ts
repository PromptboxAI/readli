import type { HouseholdEntitlement } from "@/lib/family/model";
import type { PlanConfig } from "@/lib/family/plan";
import { trialEligibility, type RewardsConfig } from "@/lib/rewards/rewards";
import { catalogItem, type CatalogItem } from "./catalog";

/** What a parent asked to buy, checked against the plan and the household's current entitlement. */
export type CheckoutRequest =
  | { ok: true; mode: "subscription"; plan: CatalogItem; extraSlots: number; trialDays: number }
  | { ok: true; mode: "payment"; pack: CatalogItem }
  | { ok: false; status: number; code: string; message: string };

export const MAX_EXTRA_SLOTS = 4;

/** What the route knows beyond the plan: a Stripe subscription already running, and the free-trial days this family may have. */
export interface CheckoutContext {
  hasSubscription?: boolean;
  trialDays?: number;
}

export function checkoutRequest(
  plan: PlanConfig,
  entitlement: HouseholdEntitlement | null,
  item: string,
  extraSlots: unknown = 0,
  context: CheckoutContext = {},
): CheckoutRequest {
  const no = (status: number, code: string, message: string): CheckoutRequest => ({ ok: false, status, code, message });
  const chosen = catalogItem(plan, item);
  if (!chosen || chosen.id === "extra_slot") return no(400, "bad_item", "Pick Readli Family or a credit pack.");

  if (chosen.id === "family_monthly" || chosen.id === "family_annual") {
    // A trial or tester plan can upgrade to a paid one; a paid, gifted or donated plan can't buy a second.
    if (entitlement && !["trial", "tester"].includes(entitlement.source)) return no(409, "already_on_plan", "Your family already has Readli Family.");
    // A Stripe trial is already a subscription: it converts on its own, and changes go through the billing portal.
    if (context.hasSubscription) return no(409, "already_on_plan", "Your family already has Readli Family. Change it from Plan and billing.");
    const slots = Number(extraSlots ?? 0);
    if (!Number.isInteger(slots) || slots < 0 || slots > MAX_EXTRA_SLOTS) return no(400, "bad_slots", `Add between 0 and ${MAX_EXTRA_SLOTS} extra storyteller slots.`);
    if (slots > 0 && !plan.extraSlotPriceApproved) return no(403, "slots_not_for_sale", "Extra storyteller slots aren't on sale yet.");
    // A trial is never offered to a family that's already on a plan of any kind.
    const trialDays = entitlement ? 0 : Math.max(0, Math.floor(context.trialDays ?? 0));
    return { ok: true, mode: "subscription", plan: chosen, extraSlots: slots, trialDays };
  }

  // Credit packs: only for families with Readli Family, so they're never a way into the library.
  if (!plan.narrationPurchasesEnabled) return no(403, "purchases_off", "Buying Readli credits isn't switched on yet.");
  if (!entitlement) return no(403, "needs_family", "Credit packs are for families with Readli Family.");
  return { ok: true, mode: "payment", pack: chosen };
}

/**
 * Free-trial days for a family starting Readli Family: the trial length for a new family, 0 for one
 * that has had any plan before (a tester plan aside). `plans` are every plan in the grown-up's
 * households, past and present. A trial always takes a card at checkout, so it converts on its own.
 */
export function trialDaysFor(plans: readonly HouseholdEntitlement[], rewards: RewardsConfig): number {
  const decision = trialEligibility({ adultsHadFamilyBefore: plans.some((e) => e.source !== "tester"), sharedSignalUsedForTrial: false }, rewards);
  return decision.eligible ? rewards.trialDays : 0;
}

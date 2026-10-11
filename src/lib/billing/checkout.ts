import type { HouseholdEntitlement } from "@/lib/family/model";
import type { PlanConfig } from "@/lib/family/plan";
import { catalogItem, type CatalogItem } from "./catalog";

/** What a parent asked to buy, checked against the plan and the household's current entitlement. */
export type CheckoutRequest =
  | { ok: true; mode: "subscription"; plan: CatalogItem; extraSlots: number; trialDays: number }
  | { ok: true; mode: "payment"; pack: CatalogItem }
  | { ok: false; status: number; code: string; message: string };

export const MAX_EXTRA_SLOTS = 4;

export interface CheckoutHistory {
  /** The household has had a plan before (so it has a library the Archive can keep). */
  hadPlan: boolean;
  /** Free-trial days this family may start with, from trialDecision (0 when not eligible). */
  trialDays: number;
  /** A Stripe subscription is already running (a trial included): changes go through billing, not a second checkout. */
  hasSubscription: boolean;
}

export function checkoutRequest(
  plan: PlanConfig,
  entitlement: HouseholdEntitlement | null,
  item: string,
  extraSlots: unknown = 0,
  history: CheckoutHistory = { hadPlan: entitlement !== null, trialDays: 0, hasSubscription: false },
): CheckoutRequest {
  const no = (status: number, code: string, message: string): CheckoutRequest => ({ ok: false, status, code, message });
  const chosen = catalogItem(plan, item);
  if (!chosen || chosen.id === "extra_slot") return no(400, "bad_item", "Pick Readli Family or a credit pack.");

  if (chosen.id === "archive_monthly") {
    // The Archive keeps a library made with Readli Family; a family on a paid plan changes plan in billing.
    if (entitlement && !["trial", "tester"].includes(entitlement.source)) return no(409, "already_on_plan", "Your family already has a plan. Change it in billing.");
    if (history.hasSubscription) return no(409, "already_on_plan", "Your family already has a plan. Change it in billing.");
    if (!history.hadPlan) return no(409, "nothing_to_archive", "The Family Archive keeps stories made with Readli Family. Start with Readli Family.");
    return { ok: true, mode: "subscription", plan: chosen, extraSlots: 0, trialDays: 0 };
  }

  if (chosen.id === "family_monthly" || chosen.id === "family_annual") {
    // A trial or tester plan can upgrade to a paid one; a paid, gifted or donated plan can't buy a second.
    if (entitlement && !["trial", "tester"].includes(entitlement.source)) return no(409, "already_on_plan", "Your family already has Readli Family.");
    // A Stripe trial is already a subscription: it converts on its own, and changes go through billing.
    if (history.hasSubscription) return no(409, "already_on_plan", "Your family already has Readli Family. Change it from Plan and billing.");
    const slots = Number(extraSlots ?? 0);
    if (!Number.isInteger(slots) || slots < 0 || slots > MAX_EXTRA_SLOTS) return no(400, "bad_slots", `Add between 0 and ${MAX_EXTRA_SLOTS} extra storyteller slots.`);
    if (slots > 0 && !plan.extraSlotPriceApproved) return no(403, "slots_not_for_sale", "Extra storyteller slots aren't on sale yet.");
    // The free trial is for a family that has never had a plan, decided by trialDecision.
    const trialDays = entitlement ? 0 : Math.max(0, Math.floor(history.trialDays));
    return { ok: true, mode: "subscription", plan: chosen, extraSlots: slots, trialDays };
  }

  // Credit packs: only for families with Readli Family, so they're never a way into the library.
  if (!plan.narrationPurchasesEnabled) return no(403, "purchases_off", "Buying Readli credits isn't switched on yet.");
  if (!entitlement) return no(403, "needs_family", "Credit packs are for families with Readli Family.");
  return { ok: true, mode: "payment", pack: chosen };
}

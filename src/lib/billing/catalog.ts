import type { PlanConfig } from "@/lib/family/plan";

/**
 * What Readli sells, built from the plan settings (src/lib/family/plan.ts), the one source of prices.
 * Each item's Stripe lookup key includes its amount, so changing a price in the admin portal makes a
 * new Stripe price for new purchases and never reprices what a family already pays.
 */
export type CatalogItemId = "family_monthly" | "family_annual" | "extra_slot" | "extra_slot_annual" | `credit_pack:${string}`;

export interface CatalogItem {
  id: CatalogItemId;
  name: string;
  amountCents: number;
  /** Recurring interval, or null for a one-time purchase. */
  interval: "month" | "year" | null;
  lookupKey: string;
  /** Readli credits a pack adds; absent for everything else. */
  credits?: number;
}

export function lookupKey(id: string, amountCents: number): string {
  return `readli_${id.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${amountCents}`;
}

export function catalog(plan: PlanConfig): CatalogItem[] {
  const item = (id: CatalogItemId, name: string, amountCents: number, interval: CatalogItem["interval"], credits?: number): CatalogItem => ({
    id,
    name,
    amountCents,
    interval,
    lookupKey: lookupKey(id, amountCents),
    ...(credits === undefined ? {} : { credits }),
  });
  return [
    item("family_monthly", "Readli Family (monthly)", plan.familyMonthlyPriceCents, "month"),
    item("family_annual", "Readli Family (annual)", plan.familyAnnualPriceCents, "year"),
    item("extra_slot", "Extra family storyteller slot", plan.extraSlotPriceCents, "month"),
    // Stripe bills every item on a subscription on the same interval, so a yearly plan's slot is billed
    // yearly: twelve months of the monthly slot price. Its lookup key also starts readli_extra_slot_.
    item("extra_slot_annual", "Extra family storyteller slot (yearly)", plan.extraSlotPriceCents * 12, "year"),
    ...plan.creditPacks.map((p) => item(`credit_pack:${p.id}`, `${p.credits} Readli credits`, p.priceCents, null, p.credits)),
  ];
}

/** The extra storyteller slot that bills alongside a plan: monthly for a monthly plan, yearly for a yearly one. */
export function slotItemFor(plan: PlanConfig, interval: "month" | "year"): CatalogItem {
  return catalogItem(plan, interval === "year" ? "extra_slot_annual" : "extra_slot")!;
}

export function catalogItem(plan: PlanConfig, id: string): CatalogItem | undefined {
  return catalog(plan).find((i) => i.id === id);
}

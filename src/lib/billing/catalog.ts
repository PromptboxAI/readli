import type { PlanConfig } from "@/lib/family/plan";

/**
 * What Readli sells, built from the plan settings (src/lib/family/plan.ts), the one source of prices.
 * Each item's Stripe lookup key includes its amount, so changing a price in the admin portal makes a
 * new Stripe price for new purchases and never reprices what a family already pays.
 */
export type CatalogItemId = "family_monthly" | "family_annual" | "extra_slot" | `credit_pack:${string}`;

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
    ...plan.creditPacks.map((p) => item(`credit_pack:${p.id}`, `${p.credits} Readli credits`, p.priceCents, null, p.credits)),
  ];
}

export function catalogItem(plan: PlanConfig, id: string): CatalogItem | undefined {
  return catalog(plan).find((i) => i.id === id);
}

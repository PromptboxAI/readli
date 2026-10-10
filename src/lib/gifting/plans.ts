import { DEFAULT_PLAN } from "@/lib/entitlements/config";

/**
 * Invite & Gift plans (Kevin, 2026-10-10). The giver pays; the recipient runs their own household,
 * which gets the same Readli Family entitlements as a paid plan. Prices follow the admin-configured
 * Readli Family monthly price (launch: $14.99), one month per month gifted. Checkout stays closed
 * until payments are switched on.
 */
export type GiftPlanId = "prepaid_1m" | "prepaid_3m" | "prepaid_12m" | "sponsored_monthly";

export interface GiftPlan {
  id: GiftPlanId;
  name: string;
  kind: "prepaid" | "recurring";
  /** Months covered up front; null for a recurring sponsorship. */
  months: number | null;
  summary: string;
  /** Smallest currency unit. Null means not on sale yet. */
  priceCents: number | null;
}

export const GIFT_PLANS: readonly GiftPlan[] = [
  {
    id: "prepaid_1m",
    name: "One month",
    kind: "prepaid",
    months: 1,
    summary: "A month of family stories, paid once.",
    priceCents: DEFAULT_PLAN.familyMonthlyPriceCents,
  },
  {
    id: "prepaid_3m",
    name: "Three months",
    kind: "prepaid",
    months: 3,
    summary: "A season of bedtime stories, paid once.",
    priceCents: DEFAULT_PLAN.familyMonthlyPriceCents * 3,
  },
  {
    id: "prepaid_12m",
    name: "A whole year",
    kind: "prepaid",
    months: 12,
    summary: "Twelve months of stories, paid once.",
    priceCents: DEFAULT_PLAN.familyMonthlyPriceCents * 12,
  },
  {
    id: "sponsored_monthly",
    name: "Monthly sponsorship",
    kind: "recurring",
    months: null,
    summary: "You cover their plan each month until you stop it.",
    priceCents: DEFAULT_PLAN.familyMonthlyPriceCents,
  },
];

export function giftPlan(id: string): GiftPlan | undefined {
  return GIFT_PLANS.find((p) => p.id === id);
}

/** Payments open only when switched on AND every plan has a price. */
export function giftPaymentsOpen(
  plans: readonly GiftPlan[] = GIFT_PLANS,
  enabled = process.env.NEXT_PUBLIC_GIFT_PAYMENTS_ENABLED === "true",
): boolean {
  return enabled && plans.every((p) => p.priceCents !== null && p.priceCents > 0);
}

export function priceLabel(plan: GiftPlan): string {
  if (plan.priceCents === null) return "Price coming soon";
  const amount = (plan.priceCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  return plan.kind === "recurring" ? `${amount} a month` : amount;
}

/** Safe for client components: no server-only imports. */
export const COMPLIMENTARY_KINDS = ["raffle", "auction", "gift_basket", "school", "charity", "fundraiser", "promotion"] as const;
export type ComplimentaryKind = (typeof COMPLIMENTARY_KINDS)[number];
export const COMPLIMENTARY_KIND_LABELS: Record<ComplimentaryKind, string> = {
  raffle: "Raffle prize",
  auction: "Auction item",
  gift_basket: "Gift basket",
  school: "School",
  charity: "Charity",
  fundraiser: "Fundraiser",
  promotion: "Promotional giveaway",
};
/** Occasions where the family won the membership, so the page says "You've won". */
export const PRIZE_KINDS: readonly ComplimentaryKind[] = ["raffle", "auction", "gift_basket"];
export const COMPLIMENTARY_MONTHS = [1, 3, 12] as const;
export type ComplimentaryMonths = (typeof COMPLIMENTARY_MONTHS)[number];
export const DEFAULT_COMPLIMENTARY_MONTHS: ComplimentaryMonths = 12;
export const MAX_CODES_PER_BATCH = 100;

export function planIdForMonths(months: ComplimentaryMonths): "prepaid_1m" | "prepaid_3m" | "prepaid_12m" {
  return months === 1 ? "prepaid_1m" : months === 3 ? "prepaid_3m" : "prepaid_12m";
}

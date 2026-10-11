/** Safe for client components: no server-only imports. */
export const COMPLIMENTARY_KINDS = ["school", "charity", "fundraiser", "promotion"] as const;
export type ComplimentaryKind = (typeof COMPLIMENTARY_KINDS)[number];
export const COMPLIMENTARY_KIND_LABELS: Record<ComplimentaryKind, string> = {
  school: "School",
  charity: "Charity",
  fundraiser: "Fundraiser",
  promotion: "Promotional giveaway",
};
export const MAX_CODES_PER_BATCH = 100;

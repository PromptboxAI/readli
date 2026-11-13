import { formatPrice } from "@/lib/family/plan";
import { publicLibrary } from "@/lib/library/public";
import { SPONSORED } from "@/lib/sponsorship/rules";
import type { ReadliFacts } from "./comparisons";
import { pricing } from "./pricing";

/** Readli's live numbers for the comparison pages: the saved prices, trial length and library size. */
export async function readliFacts(): Promise<ReadliFacts> {
  const P = await pricing();
  return {
    readyBooks: publicLibrary().filter((b) => !b.comingSoon).length,
    monthly: formatPrice(P.familyMonthlyCents),
    annual: formatPrice(P.familyAnnualCents),
    trialDays: P.trialDays,
    maxChildProfiles: P.maxChildProfiles,
    giftHouseholds: SPONSORED.households,
  };
}

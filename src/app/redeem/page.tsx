import type { Metadata } from "next";
import { ClaimFromLink } from "@/components/gifting/ComplimentaryGift";
import { AdultPage } from "@/components/invites/AdultPage";

export const metadata: Metadata = { title: "Redeem your Readli gift | Readli", robots: { index: false }, referrer: "no-referrer" };

/**
 * Where Readli Gives Back certificates point (readli.ai/redeem#CODE, or a typed code). It's the same
 * claim flow as /claim, with the program's wording, so any complimentary code works here too.
 */
export default function RedeemPage() {
  return (
    <AdultPage wide>
      <ClaimFromLink
        path="/redeem"
        intro={{
          title: "Your Next Chapter Starts Here.",
          body: "Congratulations! You've received the gift of family storytelling. Enter your Readli gift code to activate your complimentary membership.",
          label: "Redemption code",
          button: "Redeem Gift",
        }}
      />
    </AdultPage>
  );
}

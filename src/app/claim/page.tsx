import type { Metadata } from "next";
import { ClaimFromLink } from "@/components/gifting/ComplimentaryGift";
import { AdultPage } from "@/components/invites/AdultPage";

export const metadata: Metadata = { title: "Claim your Readli gift | Readli", robots: { index: false }, referrer: "no-referrer" };

/** Where complimentary membership QR codes and certificates point: readli.ai/claim#CODE, or a typed code. */
export default function ClaimPage() {
  return (
    <AdultPage wide>
      <ClaimFromLink />
    </AdultPage>
  );
}

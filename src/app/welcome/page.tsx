import type { Metadata } from "next";
import { AdultPage, PreviewNote } from "@/components/invites/AdultPage";
import { WelcomeSteps } from "@/components/rewards/WelcomeSteps";
import { familyAccountsEnabled } from "@/lib/family/session";
import { rewardsVisible } from "@/lib/rewards/rewards";

export const metadata: Metadata = { title: "Welcome | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Adult onboarding finale. Sign-up (Phase 4) sends new adults here after their account is created. */
export default function WelcomePage() {
  return (
    <AdultPage>
      {!familyAccountsEnabled() && <PreviewNote>This is the end of grown-up sign-up. Family accounts are coming soon.</PreviewNote>}
      <WelcomeSteps showRewards={rewardsVisible()} />
    </AdultPage>
  );
}

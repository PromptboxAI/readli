import type { Metadata } from "next";
import { AdultPage, PreviewNote } from "@/components/invites/AdultPage";
import { WelcomeSteps } from "@/components/rewards/WelcomeSteps";

export const metadata: Metadata = { title: "Welcome | Readli", robots: { index: false } };

/** Adult onboarding finale. Sign-up (Phase 4) sends new adults here after their account is created. */
export default function WelcomePage() {
  return (
    <AdultPage>
      <PreviewNote>This is the end of grown-up sign-up. Family accounts are coming soon.</PreviewNote>
      <WelcomeSteps />
    </AdultPage>
  );
}

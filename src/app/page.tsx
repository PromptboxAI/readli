import { SiteHeader } from "@/components/home/SiteHeader";
import {
  FamilyCircles,
  FinalCta,
  Hero,
  HowFamiliesWork,
  KidsShelf,
  MeetReadi,
  SiteFooter,
  ThreeWaysToListen,
  TrustAndSafety,
  TryYourVoice,
} from "@/components/home/sections";

/** Section order follows Design Brief §5; Meet Readi added after the demo at Kevin's request (2026-10-10). */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <TryYourVoice />
        <MeetReadi />
        <HowFamiliesWork />
        <ThreeWaysToListen />
        <KidsShelf />
        <FamilyCircles />
        <TrustAndSafety />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

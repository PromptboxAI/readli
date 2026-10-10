import { SiteHeader } from "@/components/home/SiteHeader";
import {
  FamilyCircles,
  FinalCta,
  Hero,
  HowFamiliesWork,
  KidsShelf,
  SiteFooter,
  ThreeWaysToListen,
  TrustAndSafety,
  TryYourVoice,
} from "@/components/home/sections";

/** Section order is fixed by Design Brief §5. */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <TryYourVoice />
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

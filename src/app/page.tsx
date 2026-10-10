import { FamilyVoices } from "@/components/home/FamilyVoices";
import { SiteHeader } from "@/components/home/SiteHeader";
import {
  FamilyCircles,
  FinalCta,
  Hero,
  HowFamiliesWork,
  KidsShelf,
  SiteFooter,
  ThreeWaysToListen,
  TryYourVoice,
} from "@/components/home/sections";

/** Section order follows Design Brief §5. Family voices privacy section follows the family circle at Kevin's
 *  request; Meet Readi and "Safe for families by design" were removed at his request (2026-10-10). */
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
        <FamilyVoices />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

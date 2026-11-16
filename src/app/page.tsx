import type { Metadata } from "next";
import { FamilyJourney } from "@/components/home/FamilyJourney";
import { FamilyVoices } from "@/components/home/FamilyVoices";
import { ListenAnywhere } from "@/components/home/ListenAnywhere";
import { SiteHeader } from "@/components/home/SiteHeader";
import { FounderStory } from "@/components/home/FounderStory";
import { Testimonials } from "@/components/home/Testimonials";
import { VoiceStaysYours } from "@/components/home/VoiceStaysYours";
import {
  FamilyCircles,
  FinalCta,
  Hero,
  HowFamiliesWork,
  KidsShelf,
  SiteFooter,
  TryYourVoice,
} from "@/components/home/sections";
import { ORGANIZATION_ID, organizationNode, websiteNode } from "@/lib/seo/organization";
import { SITE_DESCRIPTION, jsonLd, publicPageMetadata, webPageNode } from "@/lib/seo/site";
import { PAGE_TITLES } from "@/lib/seo/titles";

export const metadata: Metadata = publicPageMetadata({
  title: PAGE_TITLES.home,
  description: SITE_DESCRIPTION,
  path: "/",
});

const siteLd = {
  "@context": "https://schema.org",
  "@graph": [organizationNode(), websiteNode(), webPageNode({ path: "/", title: PAGE_TITLES.home, description: SITE_DESCRIPTION, extra: { about: { "@id": ORGANIZATION_ID } } })],
};

/** Section order follows Design Brief §5. Family voices privacy section follows the family circle at Kevin's
 *  request; Meet Readi and "Safe for families by design" were removed at his request (2026-10-10). */
export default function HomePage() {
  return (
    <>
      <SiteHeader logInUntilHeroScrolled />
      <main>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(siteLd)} />
        <Hero />
        <TryYourVoice />
        <HowFamiliesWork />
        <FamilyJourney />
        <KidsShelf />
        <ListenAnywhere />
        {/* "For Families" (/#families) lands here; on phones the family circle is hidden, so it lands on family voices. */}
        <div id="families" className="scroll-mt-20">
          <FamilyCircles />
          <FamilyVoices />
        </div>
        <FounderStory />
        <VoiceStaysYours />
        {/* Social proof sits right above the closing sign-up buttons (Kevin, 2026-11-15). */}
        <Testimonials />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

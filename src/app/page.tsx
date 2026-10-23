import type { Metadata } from "next";
import { FamilyJourney } from "@/components/home/FamilyJourney";
import { FamilyVoices } from "@/components/home/FamilyVoices";
import { SiteHeader } from "@/components/home/SiteHeader";
import {
  FamilyCircles,
  FinalCta,
  Hero,
  HowFamiliesWork,
  KidsShelf,
  SiteFooter,
  TryYourVoice,
} from "@/components/home/sections";
import { SOCIAL_ACCOUNTS } from "@/lib/content/social";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, absoluteUrl, jsonLd, publicPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Readli: Every Book. Every Voice.",
  description: SITE_DESCRIPTION,
  path: "/",
});

const siteLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: absoluteUrl("/icon.png"),
      slogan: SITE_TAGLINE,
      description: SITE_DESCRIPTION,
      sameAs: SOCIAL_ACCOUNTS.map((a) => a.url),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

/** Section order follows Design Brief §5. Family voices privacy section follows the family circle at Kevin's
 *  request; Meet Readi and "Safe for families by design" were removed at his request (2026-10-10). */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(siteLd)} />
        <Hero />
        <TryYourVoice />
        <HowFamiliesWork />
        <FamilyJourney />
        <KidsShelf />
        <FamilyCircles />
        <FamilyVoices />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

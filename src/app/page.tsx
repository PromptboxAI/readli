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
import { COMPANY, FOUNDERS } from "@/lib/content/company";
import { BRAND_PROFILES, SOCIAL_ACCOUNTS } from "@/lib/content/social";
import { SITE_ALTERNATE_NAMES, SITE_DESCRIPTION, SITE_LONG_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, absoluteUrl, jsonLd, publicPageMetadata, webPageNode } from "@/lib/seo/site";
import { PAGE_TITLES } from "@/lib/seo/titles";

export const metadata: Metadata = publicPageMetadata({
  title: PAGE_TITLES.home,
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
      alternateName: SITE_ALTERNATE_NAMES,
      legalName: COMPANY.legalName,
      email: COMPANY.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: COMPANY.street,
        addressLocality: COMPANY.city,
        addressRegion: COMPANY.region,
        postalCode: COMPANY.postalCode,
        addressCountry: COMPANY.country,
      },
      url: SITE_URL,
      logo: absoluteUrl("/icon.png"),
      slogan: SITE_TAGLINE,
      description: SITE_LONG_DESCRIPTION,
      sameAs: [...SOCIAL_ACCOUNTS.map((a) => a.url), ...BRAND_PROFILES],
      founder: FOUNDERS.map((f) => ({ "@type": "Person", name: f.name, jobTitle: f.title })),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: SITE_ALTERNATE_NAMES,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    webPageNode({ path: "/", title: PAGE_TITLES.home, description: SITE_DESCRIPTION }),
  ],
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
        <FamilyCircles />
        <FamilyVoices />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

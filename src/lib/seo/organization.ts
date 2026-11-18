import { COMPANY, FOUNDERS } from "@/lib/content/company";
import { BRAND_PROFILES, SOCIAL_ACCOUNTS } from "@/lib/content/social";
import { SITE_ALTERNATE_NAMES, SITE_DESCRIPTION, SITE_LONG_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, absoluteUrl } from "@/lib/seo/site";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/**
 * The Readli Organization node: Google's brand (Knowledge Graph) signals. It is repeated in full on the
 * home, About and Company pages so each of them ties the name "Readli" to readli.ai, the logo and the
 * official accounts, which helps Google tell Readli apart from similarly spelled brands.
 */
export function organizationNode(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
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
    logo: { "@type": "ImageObject", "@id": `${SITE_URL}/#logo`, url: absoluteUrl("/icon.png"), contentUrl: absoluteUrl("/icon.png"), width: 512, height: 512, caption: SITE_NAME },
    image: { "@id": `${SITE_URL}/#logo` },
    slogan: SITE_TAGLINE,
    description: SITE_LONG_DESCRIPTION,
    sameAs: [...SOCIAL_ACCOUNTS.map((a) => a.url), ...BRAND_PROFILES],
    founder: FOUNDERS.map((f) => ({ "@type": "Person", name: f.name, jobTitle: f.title })),
  };
}

/** The WebSite node. Google's site-name system reads its name and alternate spellings. */
export function websiteNode(): Record<string, unknown> {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

import type { Metadata } from "next";

/** The public address of the site. Previews and local builds still point canonical links here. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://readli.ai").replace(/\/$/, "");

export const SITE_NAME = "Readli";
/** Other ways people write the name. Google's site-name system reads these from the WebSite structured data. */
export const SITE_ALTERNATE_NAMES = ["Readli.ai", "Readli AI"];
export const SITE_TAGLINE = "Every Book. Every Voice.";
/** Kevin's approved short description (2026-10-27): page descriptions and share cards. */
export const SITE_DESCRIPTION = "Readli reads classic children's books aloud in the voices of the people your kids love.";
/** Kevin's approved long description (2026-10-27): the company page, structured data and llms.txt. */
export const SITE_LONG_DESCRIPTION =
  "Readli is a family storytelling app. A parent, grandparent or other loved one records about a minute of their voice, and Readli reads classic storybooks aloud in that voice. Family voices are private: a child hears a storyteller only after both the storyteller and a parent approve. Readli Voice is free for anyone who records, and Readli Family is the paid plan for households.";

/** Only the production deployment is open to search engines; previews and local builds ask not to be indexed. */
export function indexable(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return env.NODE_ENV === "production";
}

export function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Shared Open Graph fields. A page that sets its own `openGraph` replaces the root's, so it spreads these in. */
export const baseOpenGraph = {
  siteName: SITE_NAME,
  locale: "en_US",
  type: "website",
} satisfies NonNullable<Metadata["openGraph"]>;

/** Metadata for signed-in, token and in-progress pages that should never show up in search results. */
export const PRIVATE_ROBOTS: Metadata["robots"] = { index: false, follow: false };

/** Renders schema.org data as JSON-LD. `<` is escaped so text can't close the script tag. */
export function jsonLd(data: unknown): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

/**
 * Metadata for a public, indexable page: title, description, canonical link and matching share-card
 * text. Without `images`, the share card falls back to the default image in src/app/opengraph-image.tsx.
 */
export function publicPageMetadata({
  title,
  description,
  path,
  images,
  type,
}: {
  title: string;
  description: string;
  path: string;
  images?: { url: string; alt: string; width?: number; height?: number }[];
  type?: "website" | "book" | "article";
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...baseOpenGraph, type: type ?? baseOpenGraph.type, title, description, url: path, ...(images ? { images } : {}) } as Metadata["openGraph"],
    twitter: { card: "summary_large_image", title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}

/** The share image every page falls back to (src/app/opengraph-image.tsx). */
export const DEFAULT_PAGE_IMAGE = "/opengraph-image";

/**
 * The schema.org node for one public page (SEO audit g_structured_data): its headline is the page's
 * title as rendered, and it points at the site and the organization described on the home page.
 */
export function webPageNode({
  path,
  title,
  description,
  type = "WebPage",
  image,
  extra,
}: {
  path: string;
  title: string;
  description?: string | null;
  type?: "WebPage" | "CollectionPage" | "AboutPage" | "FAQPage" | "ItemPage";
  image?: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const url = absoluteUrl(path);
  return {
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name: title,
    headline: title,
    ...(description ? { description } : {}),
    mainEntityOfPage: url,
    image: absoluteUrl(image ?? DEFAULT_PAGE_IMAGE),
    inLanguage: "en",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    ...extra,
  };
}

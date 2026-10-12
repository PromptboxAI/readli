import type { Metadata } from "next";

/** The public address of the site. Previews and local builds still point canonical links here. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://readli.ai").replace(/\/$/, "");

export const SITE_NAME = "Readli";
export const SITE_TAGLINE = "Every Book. Every Voice.";
export const SITE_DESCRIPTION =
  "Their favorite stories, read by their favorite people. Record a minute of your voice and hear classic storybooks read aloud the way only you can, then invite family to join your storytelling library.";

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
    openGraph: { ...baseOpenGraph, ...(type ? { type } : {}), title, description, url: path, ...(images ? { images } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}

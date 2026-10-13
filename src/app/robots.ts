import type { MetadataRoute } from "next";
import { SITE_URL, indexable } from "@/lib/seo/site";

/**
 * Private pages (family, kids, voice links, invites) carry a noindex tag instead of a Disallow line,
 * because a crawler that is disallowed never fetches the page and so never sees the noindex.
 */
export default function robots(): MetadataRoute.Robots {
  if (!indexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/auth/", "/design/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

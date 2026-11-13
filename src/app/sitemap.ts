import type { MetadataRoute } from "next";
import { publicPages } from "@/lib/seo/pages";
import { absoluteUrl } from "@/lib/seo/site";
import CONTENT_DATES from "@/lib/seo/content-dates.json";

const dates: Record<string, string | undefined> = CONTENT_DATES;

/**
 * Every public page, with the date its content last changed (from git history, written by
 * `npm run seo:dates`), so crawlers can tell new and updated pages from unchanged ones.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages().map((p) => ({
    url: absoluteUrl(p.path),
    ...(dates[p.path] ? { lastModified: dates[p.path] } : {}),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}

import { unstable_cache } from "next/cache";
import { accountDb } from "@/lib/family/account-store";
import { SITE_BANNER_TAG, readSiteBanner } from "./site-banner";

/** The saved banner for the public header, cached for a few minutes and refreshed at once when an admin saves. */
export const cachedSiteBanner = unstable_cache(() => readSiteBanner(accountDb()), [SITE_BANNER_TAG], { tags: [SITE_BANNER_TAG], revalidate: 300 });

"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { syncAdsOptOut, trackMeta } from "@/lib/marketing/meta-pixel";

/** A PageView for each allowed page as it opens, including moves within the site. See lib/marketing/meta-pixel. */
export function MetaPixel() {
  const pathname = usePathname();
  useEffect(() => syncAdsOptOut(), []);
  useEffect(() => {
    trackMeta("PageView");
  }, [pathname]);
  return null;
}

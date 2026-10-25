"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackMeta } from "@/lib/marketing/meta-pixel";

/** A PageView for each allowed page as it opens, including moves within the site. See lib/marketing/meta-pixel. */
export function MetaPixel() {
  const pathname = usePathname();
  useEffect(() => {
    trackMeta("PageView");
  }, [pathname]);
  return null;
}

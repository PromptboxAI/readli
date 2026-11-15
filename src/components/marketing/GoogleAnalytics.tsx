"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackGaPageView } from "@/lib/marketing/google-analytics";

/** A GA4 page view for each allowed page as it opens. See lib/marketing/google-analytics. */
export function GoogleAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    trackGaPageView();
  }, [pathname]);
  return null;
}

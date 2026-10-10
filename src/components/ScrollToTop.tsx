"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Opens every new page at the top. Next.js skips its own scroll when the first element on the
 * page (our sticky header) is already on screen, so links from the footer landed mid-page.
 * Links to an anchor (/#families) keep their jump.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

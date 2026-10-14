"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Family pages never show a stale copy after Back or Forward. A page restored from the browser's
 * back-forward cache is reloaded, so the server decides again (on a device that has since become a
 * Readli Kids device, that sends Back to the kids bookshelf). A page the app's router restores from
 * its own cache on Back is refreshed, so a change made on the next page (an approval, a slot) shows.
 */
export function ReloadOnRestore() {
  const router = useRouter();

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && window.location.reload();
    // The timeout lets the router finish restoring the page Back landed on before it is refreshed.
    const onPop = () => window.setTimeout(() => router.refresh(), 0);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("popstate", onPop);
    };
  }, [router]);

  return null;
}

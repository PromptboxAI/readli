"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// Module-level, because each page renders its own copy of this component: the one that sees Back is
// not the one mounted on the page Back lands on.
let popped = false;

/**
 * Family pages never show a stale copy after Back or Forward. A page restored from the browser's
 * back-forward cache is reloaded, so the server decides again (on a device that has since become a
 * Readli Kids device, that sends Back to the kids bookshelf). A page the app's router restores from
 * its own cache on Back is refreshed, so a change made on the next page (an approval, a slot) shows.
 */
export function ReloadOnRestore() {
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && window.location.reload();
    const onPop = () => {
      popped = true;
    };
    window.addEventListener("pageshow", onShow);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    if (!popped) return;
    popped = false;
    router.refresh();
  }, [path, router]);

  return null;
}

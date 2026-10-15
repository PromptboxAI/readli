"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Set by Back or Forward and cleared once the page it lands on has asked the server again. */
let restoring = false;

/**
 * Family pages never show a stale copy after Back or Forward. A page restored from the browser's
 * back-forward cache is reloaded, so the server decides again (on a device that has since become a
 * Readli Kids device, that sends Back to the kids bookshelf). A page the app's router restores from
 * its own cache on Back is refreshed once it is showing, so a change made on the next page (an
 * approval, a slot) shows. Refreshing earlier could refresh the page being left instead.
 */
export function ReloadOnRestore() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && window.location.reload();
    const onPop = () => {
      restoring = true;
    };
    window.addEventListener("pageshow", onShow);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // Runs when the restored page mounts or its path changes, i.e. after the router has switched to it.
  useEffect(() => {
    if (!restoring) return;
    restoring = false;
    router.refresh();
  }, [pathname, router]);

  return null;
}

"use client";

import { useEffect } from "react";

/**
 * Parent pages restored from the browser's back-forward cache are reloaded, so the server decides
 * again. On a device that has since become a Readli Kids device, that sends Back to the kids bookshelf.
 */
export function ReloadOnRestore() {
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && window.location.reload();
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return null;
}

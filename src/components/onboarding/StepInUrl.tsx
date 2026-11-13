"use client";

import { useEffect } from "react";

/**
 * Writes the step on screen into the address bar when the page chose it by itself (no ?step= yet), so
 * finishing something on the step, like adding a first child or keeping a voice, refreshes this same
 * step instead of jumping ahead to whatever comes next.
 *
 * The history state passed is null on purpose. Next's router only takes up a URL changed with
 * replaceState when the state isn't its own: passing window.history.state along (which is Next's) changes
 * the address bar but leaves the router on the old URL, so its next refresh still had no ?step= and
 * skipped ahead.
 */
export function StepInUrl({ step }: { step: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("step")) return;
    url.searchParams.set("step", step);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [step]);
  return null;
}

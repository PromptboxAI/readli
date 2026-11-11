"use client";

import { useEffect } from "react";

/**
 * Writes the step on screen into the address bar when the page chose it by itself (no ?step= yet), so
 * finishing something on the step, like adding a first child or keeping a voice, refreshes this same
 * step instead of jumping ahead to whatever comes next.
 */
export function PinStep({ step }: { step: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("step")) return;
    url.searchParams.set("step", step);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [step]);
  return null;
}

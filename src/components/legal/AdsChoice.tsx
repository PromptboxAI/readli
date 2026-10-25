"use client";

import { useEffect, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { adsOptedOut, setAdsOptOut } from "@/lib/marketing/meta-pixel";

/** The "Do Not Sell or Share" switch for this browser. Global Privacy Control already counts as opting out. */
export function AdsChoice() {
  const [state, setState] = useState<"loading" | "in" | "out" | "gpc">("loading");
  useEffect(() => {
    const gpc = Boolean((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
    setState(gpc ? "gpc" : adsOptedOut() ? "out" : "in");
  }, []);
  if (state === "loading") return null;
  if (state === "gpc") {
    return (
      <p role="status" className="rounded-2xl bg-mint/50 p-4" data-testid="ads-choice">
        Your browser sends a Global Privacy Control signal, so you&apos;re already opted out. Readli doesn&apos;t load the Meta Pixel for you.
      </p>
    );
  }
  const out = state === "out";
  return (
    <div className="flex flex-col gap-3" data-testid="ads-choice">
      <p role="status" className={`rounded-2xl p-4 ${out ? "bg-mint/50" : "bg-surface ring-2 ring-ink/10"}`}>
        {out ? "You're opted out on this browser. Readli won't load the Meta Pixel here." : "You're not opted out on this browser."}
      </p>
      <button
        type="button"
        className={`${out ? buttonSecondary : buttonPrimary} self-start`}
        onClick={() => {
          setAdsOptOut(!out);
          setState(out ? "in" : "out");
        }}
      >
        {out ? "Turn ad measurement back on" : "Opt out of sale and sharing"}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BannerBar } from "@/components/marketing/BannerBar";
import { bannerLive, type SiteBanner as Banner } from "@/lib/marketing/site-banner";

const DISMISSED = "readli-banner-dismissed";

/**
 * The announcement bar above the public site header (see lib/marketing/site-banner). Closing it hides
 * it for the rest of the visit; a changed message shows again. The header only renders it while live;
 * the check here hides a bar left open past its end date.
 */
export function SiteBanner({ banner }: { banner: Banner }) {
  const key = `${banner.updatedAt ?? ""}|${banner.message}|${banner.style}`;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISSED) === key) setHidden(true);
    } catch {}
    if (!bannerLive(banner)) setHidden(true);
  }, [banner, key]);

  if (hidden) return null;
  function close() {
    setHidden(true);
    try {
      sessionStorage.setItem(DISMISSED, key);
    } catch {}
  }

  return (
    <div role="region" aria-label="Announcement" data-testid="site-banner">
      <BannerBar
        style={banner.style}
        message={banner.message}
        linkText={banner.linkText}
        linkUrl={banner.linkUrl}
        closeButton={
          <button
            type="button"
            onClick={close}
            aria-label="Close announcement"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ivory/85 hover:bg-ivory/10 hover:text-ivory"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        }
      />
    </div>
  );
}

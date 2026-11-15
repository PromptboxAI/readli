"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bannerLive, safeBannerLink, type SiteBanner as Banner } from "@/lib/marketing/site-banner";

const DISMISSED = "readli-banner-dismissed";

/**
 * The announcement bar above the public site header (see lib/marketing/site-banner). Closing it hides
 * it for the rest of the visit; a changed message shows again. The header only renders it while live;
 * the check here hides a bar left open past its end date.
 */
export function SiteBanner({ banner }: { banner: Banner }) {
  const key = `${banner.updatedAt ?? ""}|${banner.message}`;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISSED) === key) setHidden(true);
    } catch {}
    if (!bannerLive(banner)) setHidden(true);
  }, [banner, key]);

  if (hidden) return null;
  const href = banner.linkText ? safeBannerLink(banner.linkUrl) : null;
  const external = href?.startsWith("https://");

  function close() {
    setHidden(true);
    try {
      sessionStorage.setItem(DISMISSED, key);
    } catch {}
  }

  return (
    <div role="region" aria-label="Announcement" className="bg-navy text-ivory" data-testid="site-banner">
      <div className="mx-auto flex max-w-6xl items-center gap-2 py-2 pl-4 pr-1 sm:pl-6">
        <p className="flex-1 text-center text-sm leading-snug sm:text-base">
          <span>{banner.message}</span>
          {href && (
            <>
              {" "}
              {external ? (
                <a href={href} className="whitespace-nowrap font-display font-semibold text-sunshine underline underline-offset-4 hover:no-underline">
                  {banner.linkText}
                </a>
              ) : (
                <Link href={href} className="whitespace-nowrap font-display font-semibold text-sunshine underline underline-offset-4 hover:no-underline">
                  {banner.linkText}
                </Link>
              )}
            </>
          )}
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="Close announcement"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ivory/80 hover:bg-ivory/10 hover:text-ivory"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { initials } from "@/lib/content/example-family";

/**
 * Selfie avatar, or tinted initials until the person adds a selfie. Photos are served through
 * short-lived signed links, so a page left open can find its link expired: the photo is then
 * asked for again once, and if that fails too the initials show instead of a broken image.
 */
export function StorytellerAvatar({
  name,
  avatarUrl,
  tint,
  size = "md",
  muted = false,
}: {
  name: string;
  avatarUrl: string | null;
  tint: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  muted?: boolean;
}) {
  const [failed, setFailed] = useState<{ url: string; tries: number; at: number } | null>(null);
  const dims = { xs: "size-8 text-xs", sm: "size-10 text-base", md: "size-14 text-xl", lg: "size-24 text-3xl", xl: "size-36 text-5xl sm:size-44" }[size];
  const ring = muted ? "border-dashed border-ink/40 opacity-70" : "border-ink";
  const tries = failed?.url === avatarUrl ? failed.tries : 0;
  if (avatarUrl && tries < 2) {
    const src = tries ? `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}retry=${failed!.at}` : avatarUrl;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user selfies come from signed storage URLs
      <img
        key={src}
        src={src}
        alt=""
        onError={(e) => setFailed({ url: avatarUrl, tries: tries + 1, at: Math.round(e.timeStamp) })}
        className={`${dims} shrink-0 rounded-full border-[3px] object-cover ${ring}`}
      />
    );
  }
  return (
    <span aria-hidden="true" className={`grid ${dims} shrink-0 place-items-center rounded-full border-[3px] font-display font-semibold text-ink ${tint} ${ring}`}>
      {initials(name)}
    </span>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

const DAY_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const option = "flex flex-col rounded-lg border border-ink/15 bg-surface px-3 py-2 text-left text-sm hover:bg-ivory";

/**
 * What a sponsored family can do when a story needs more credits than they have, in the approved
 * order. Asking the sponsor tells them the family's name only, never the story.
 */
export function GiftShortOptions(props: { giverName: string; renewsAt: string | null; chapters: boolean; buyCreditsHref: string | null }) {
  const [asked, setAsked] = useState<"idle" | "busy" | "done" | "error">("idle");
  const refresh = props.renewsAt ? DAY_FMT.format(new Date(props.renewsAt)) : null;
  async function ask() {
    setAsked("busy");
    const res = await fetch("/api/sponsorships/ask", { method: "POST" }).catch(() => null);
    setAsked(res?.ok ? "done" : "error");
  }
  return (
    <div className="flex flex-col gap-2" data-testid="gift-short-options">
      {props.chapters && (
        <a href="#chapters" className={option}>
          <span className="font-semibold">Prepare a chapter now</span>
          <span className="text-muted">Chapters cost less than the whole book</span>
        </a>
      )}
      {refresh && (
        <p className={option}>
          <span className="font-semibold">Prepare it on {refresh} when credits refresh</span>
          <span className="text-muted">Your share of {props.giverName}&apos;s gift starts again then</span>
        </p>
      )}
      {props.buyCreditsHref && (
        <Link href={props.buyCreditsHref} className={option}>
          <span className="font-semibold">Buy credits for our family</span>
          <span className="text-muted">Yours to keep, even if the gift ends</span>
        </Link>
      )}
      <button type="button" className={option} disabled={asked === "busy" || asked === "done"} onClick={ask}>
        <span className="font-semibold">{asked === "done" ? `We let ${props.giverName} know` : `Ask ${props.giverName} for more next month`}</span>
        <span className="text-muted">{asked === "error" ? "That didn't work. Please try again." : `${props.giverName} won't see which story`}</span>
      </button>
    </div>
  );
}

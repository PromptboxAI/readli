"use client";

import { useState } from "react";

/** A child asks a grown-up for a story. It only sends the request; a grown-up decides whether to prepare it. */
export function AskButton({
  childId,
  bookSlug,
  title,
  initial,
  size = "card",
}: {
  childId: string;
  bookSlug: string;
  title: string;
  initial: boolean;
  /** "card" sits under a cover in a grid; "large" is the one big action on a book's own page. */
  size?: "card" | "large";
}) {
  const large = size === "large";
  const [asked, setAsked] = useState(initial);
  const [busy, setBusy] = useState(false);
  if (asked) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-mint-deep font-display font-semibold text-white ${large ? "min-h-16 px-6 text-xl" : "min-h-11 px-3 text-sm"}`}
        data-testid={`asked-${bookSlug}`}
      >
        Asked ✓<span className="sr-only">: a grown-up will see you&apos;d like {title}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/kids/${childId}/requests`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bookSlug }),
        }).catch(() => null);
        setBusy(false);
        if (res?.ok) setAsked(true);
      }}
      className={
        large
          ? "inline-flex min-h-16 items-center justify-center rounded-full bg-coral-strong px-6 text-center font-display text-xl font-semibold text-white shadow-[0_6px_0_var(--color-coral-deep)] active:translate-y-1 active:shadow-[0_2px_0_var(--color-coral-deep)] disabled:opacity-60"
          : "inline-flex min-h-11 items-center justify-center rounded-full border-[3px] border-ink px-3 text-center font-display text-sm leading-tight font-semibold disabled:opacity-60"
      }
      data-testid={`ask-${bookSlug}`}
    >
      Ask a grown-up<span className="sr-only"> for {title}</span>
    </button>
  );
}

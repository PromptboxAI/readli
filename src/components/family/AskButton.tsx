"use client";

import { useState } from "react";

/** A child asks a grown-up for a story. It only sends the request; a grown-up decides whether to prepare it. */
export function AskButton({ childId, bookSlug, title, initial }: { childId: string; bookSlug: string; title: string; initial: boolean }) {
  const [asked, setAsked] = useState(initial);
  const [busy, setBusy] = useState(false);
  if (asked) {
    return (
      <span className="inline-flex min-h-11 items-center justify-center rounded-full bg-mint-deep px-3 font-display text-sm font-semibold text-white" data-testid={`asked-${bookSlug}`}>
        Asked ✓<span className="sr-only">: a grown-up will see you'd like {title}</span>
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
      className="inline-flex min-h-11 items-center justify-center rounded-full border-[3px] border-ink px-3 text-center font-display text-sm leading-tight font-semibold disabled:opacity-60"
      data-testid={`ask-${bookSlug}`}
    >
      Ask a grown-up<span className="sr-only"> for {title}</span>
    </button>
  );
}

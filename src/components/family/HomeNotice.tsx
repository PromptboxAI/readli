"use client";

import { useState } from "react";

/**
 * Home's one combined narration notice. "See them" and × both dismiss it for this grown-up (kept on
 * the server, so it stays dismissed on their other devices); it also goes away on its own after a week.
 */
export function HomeNotice({ text, through }: { text: string; through: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const cut = text.indexOf(": ");
  const lead = cut > 0 ? text.slice(0, cut + 1) : "";
  const dismiss = () => {
    setOpen(false);
    void fetch("/api/family/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ through }),
      keepalive: true,
    }).catch(() => undefined);
  };
  return (
    <section className="flex items-start gap-3 rounded-2xl bg-mint/40 px-4 py-3" aria-label="Updates" data-testid="notifications">
      <span aria-hidden="true" className="pt-0.5 font-semibold text-mint-deep">
        ✓
      </span>
      <p className="min-w-0 flex-1">
        {lead && <strong>{lead}</strong>}
        {lead ? text.slice(lead.length) : text}{" "}
        <a href="#bookshelf" onClick={dismiss} className="font-semibold underline underline-offset-4">
          See them
        </a>
      </p>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="-my-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full text-xl text-mint-deep hover:bg-mint/40">
        <span aria-hidden="true">×</span>
      </button>
    </section>
  );
}

"use client";

import { useState } from "react";

/** Lines shown before the rest fold away behind "N more updates". */
const SHOWN = 2;

/**
 * Home's one combined narration notice. "See them" and × both dismiss it for this grown-up (kept on
 * the server, so it stays dismissed on their other devices); it also goes away on its own after a week.
 * Each update is its own line, and past the first two the rest wait behind a toggle (Kevin, 2026-11-03).
 */
export function HomeNotice({ lines, through }: { lines: string[]; through: string }) {
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  if (!open || !lines.length) return null;
  const dismiss = () => {
    setOpen(false);
    void fetch("/api/family/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ through }),
      keepalive: true,
    }).catch(() => undefined);
  };
  const shown = all ? lines : lines.slice(0, SHOWN);
  const hidden = lines.length - shown.length;
  return (
    <section className="flex items-start gap-2 rounded-2xl bg-mint/40 py-1 pr-1 pl-3 text-sm" aria-label="Updates" data-testid="notifications">
      <span aria-hidden="true" className="py-2 font-semibold text-mint-deep">
        ✓
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-2">
        <ul className="flex flex-col gap-1">
          {shown.map((text, i) => {
            const cut = text.indexOf(": ");
            const lead = cut > 0 && cut < 40 ? text.slice(0, cut + 1) : "";
            return (
              <li key={i} className={all ? undefined : "line-clamp-3"}>
                {lead && <strong>{lead}</strong>}
                {lead ? text.slice(lead.length) : text}
              </li>
            );
          })}
        </ul>
        <p className="flex flex-wrap gap-x-4">
          <a href="#bookshelf" onClick={dismiss} className="font-semibold whitespace-nowrap underline underline-offset-4">
            See them
          </a>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="font-semibold whitespace-nowrap text-mint-deep underline underline-offset-4"
              data-testid="notifications-more"
            >
              {hidden} more {hidden === 1 ? "update" : "updates"}
            </button>
          )}
        </p>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-10 shrink-0 place-items-center rounded-full text-lg text-mint-deep hover:bg-mint/40">
        <span aria-hidden="true">×</span>
      </button>
    </section>
  );
}

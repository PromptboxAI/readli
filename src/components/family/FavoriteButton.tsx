"use client";

import { useState } from "react";

/** Heart toggle for one child's favourite stories. */
export function FavoriteButton({ childId, bookSlug, title, initial }: { childId: string; bookSlug: string; title: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Favourite ${title}`}
      onClick={async () => {
        const next = !on;
        setOn(next);
        const res = await fetch(`/api/kids/${childId}/favorites`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bookSlug, on: next }),
        });
        if (!res.ok) setOn(!next);
      }}
      className="grid size-12 shrink-0 place-items-center rounded-full text-2xl hover:bg-coral/20"
    >
      <span aria-hidden="true" className={on ? "text-coral-deep" : "text-ink/30"}>
        ♥
      </span>
    </button>
  );
}

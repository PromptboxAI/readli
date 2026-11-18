"use client";

import { useEffect } from "react";

/** Opening the notices page counts as seeing them, so Home's notice clears for this grown-up too. */
export function MarkNoticesSeen({ through }: { through: string }) {
  useEffect(() => {
    void fetch("/api/family/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ through }),
      keepalive: true,
    }).catch(() => undefined);
  }, [through]);
  return null;
}

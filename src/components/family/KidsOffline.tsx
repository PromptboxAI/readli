"use client";

import { useEffect, useState } from "react";
import { findDownload } from "@/lib/offline/manifest";
import { checkDownloads, DOWNLOADS_CHANGED, readDownloads } from "./offline";

/**
 * Readli Kids' offline support: keeps the app's pages on this device so downloaded stories open without
 * a connection, checks this child's downloads whenever there is one (renewing their week, removing any
 * the child can't hear any more), and, on the bookshelf, says when the device is offline.
 */
export function KidsOffline({ childId, banner = false }: { childId: string; banner?: boolean }) {
  const [online, setOnline] = useState(true);
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/kids-sw.js", { scope: "/kids" }).catch(() => undefined);
    const count = () => setSaved(readDownloads().filter((e) => e.childId === childId && Date.parse(e.expiresAt) > Date.now()).length);
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void checkDownloads(childId);
    };
    update();
    count();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(DOWNLOADS_CHANGED, count);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(DOWNLOADS_CHANGED, count);
    };
  }, [childId]);

  if (!banner || online) return null;
  return (
    <p role="status" className="rounded-2xl bg-sunshine p-4 font-display text-lg font-semibold" data-testid="kids-offline">
      {saved > 0 ? "No internet right now. Stories marked Saved still play." : "No internet right now. Stories play again when you're back online."}
    </p>
  );
}

/** "Saved" on a bookshelf cover when this child has the story on this device. */
export function SavedBadge({ childId, bookSlug }: { childId: string; bookSlug: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const sync = () => setSaved(readDownloads().some((e) => e.childId === childId && e.bookSlug === bookSlug && findDownload([e], childId, bookSlug, e.voiceId)));
    sync();
    window.addEventListener(DOWNLOADS_CHANGED, sync);
    return () => window.removeEventListener(DOWNLOADS_CHANGED, sync);
  }, [childId, bookSlug]);
  if (!saved) return null;
  return (
    <span className="absolute bottom-2 left-2 rounded-full bg-mint px-2 py-0.5 text-xs font-bold text-ink" data-testid="saved-badge">
      Saved
    </span>
  );
}

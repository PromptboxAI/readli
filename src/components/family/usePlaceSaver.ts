"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

export interface Place {
  sentence: number;
  voiceId: string | null;
  textRevision: string;
}

type Pending = Place & { listenedAt: number };

function readPending(key: string): Pending | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

function writePending(key: string, p: Pending | null) {
  try {
    if (p) window.localStorage.setItem(key, JSON.stringify(p));
    else window.localStorage.removeItem(key);
  } catch {
    // Storage can be blocked; the place is still sent, just not kept for a retry.
  }
}

/**
 * Saves a listener's place as it changes. Each save says when the place was heard, by this device's
 * clock, so the server keeps the place heard last even when saves arrive out of order. A save that
 * doesn't get through is kept on this device and sent again when the connection comes back or the
 * player next opens. When one sent as the player opens is newer than what the server had, `recovered` is
 * told, so the player can pick up there.
 */
export function usePlaceSaver(url: string, storageKey: string, extra: Record<string, unknown>, recovered?: (place: Place) => void) {
  const on = useRef({ extra, recovered });
  on.current = { extra, recovered };

  const send = useCallback(
    async (p: Pending) => {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...on.current.extra, sentence: p.sentence, voiceId: p.voiceId, textRevision: p.textRevision, listenedAt: p.listenedAt, sentAt: Date.now() }),
        keepalive: true,
      }).catch(() => null);
      if (!res?.ok) return null;
      // Only forget the place that was sent; a newer one may have been kept meanwhile.
      if (readPending(storageKey)?.listenedAt === p.listenedAt) writePending(storageKey, null);
      const body = (await res.json().catch(() => null)) as { saved?: boolean } | null;
      return body?.saved ?? true;
    },
    [url, storageKey],
  );

  const save = useCallback(
    (place: Place) => {
      const p = { ...place, listenedAt: Date.now() };
      writePending(storageKey, p);
      void send(p);
    },
    [storageKey, send],
  );

  // A place kept from a save that didn't get through goes first, before anything new is saved.
  // Only a place recovered as the player opens is offered back; later retries just save.
  useEffect(() => {
    const flush = async (opening: boolean) => {
      const p = readPending(storageKey);
      if (p && (await send(p)) && opening) on.current.recovered?.(p);
    };
    void flush(true);
    const online = () => void flush(false);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [storageKey, send]);

  return useMemo(() => ({ save }), [save]);
}

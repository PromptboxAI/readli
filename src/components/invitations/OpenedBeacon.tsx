"use client";

import { useEffect } from "react";

/**
 * Tells Readli the preview page is on someone's screen. Sent from the browser after a short pause
 * while the page is visible, so link scanners that only fetch the page don't count as an open.
 */
export function OpenedBeacon({ token }: { token: string }) {
  useEffect(() => {
    let sent = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const send = () => {
      if (sent || document.visibilityState !== "visible") return;
      timer = setTimeout(() => {
        if (sent || document.visibilityState !== "visible") return;
        sent = true;
        void fetch("/api/invitations/opened", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }), keepalive: true }).catch(() => {});
      }, 1500);
    };
    send();
    document.addEventListener("visibilitychange", send);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", send);
    };
  }, [token]);
  return null;
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SetKidsPin } from "./SetKidsPin";

/** Signs in as a preview family member, opens a kids profile, or signs out, then goes to `next`. */
export function SessionButton({
  as,
  next,
  className,
  children,
}: {
  as: string | null;
  next: string;
  className: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [askPin, setAskPin] = useState(false);
  const go = async (pinChecked = false) => {
    setError(null);
    // A child's space is left with the family PIN, so one is set before the first visit; otherwise the parent is stuck there.
    if (as?.startsWith("child:") && !pinChecked) {
      const pin = await fetch("/api/family/kids-pin", { cache: "no-store" }).catch(() => null);
      const body = pin?.ok ? ((await pin.json().catch(() => null)) as { set?: boolean } | null) : null;
      if (body && body.set === false) {
        setAskPin(true);
        return;
      }
    }
    const res = await fetch("/api/family/session", {
      method: as ? "POST" : "DELETE",
      headers: { "content-type": "application/json" },
      body: as ? JSON.stringify({ as }) : undefined,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Something went wrong. Please try again.");
      return;
    }
    if (as?.startsWith("child:")) {
      // Opening a kids profile: a full load that replaces this page, so Back never shows a cached parent page.
      window.location.replace(next);
      return;
    }
    router.push(next);
    router.refresh();
  };
  return (
    <>
      <button type="button" className={className} onClick={() => void go()}>
        {children}
      </button>
      {askPin && (
        <div className="w-full basis-full" data-testid="pin-before-kids">
          <SetKidsPin intro="Before you open a child's space, set a 4-digit family PIN. You'll enter it to get back to Readli Family." onSaved={() => void go(true)} />
        </div>
      )}
      {error && (
        <span role="alert" className="text-sm font-semibold text-coral-deep">
          {error}
        </span>
      )}
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const go = async () => {
    setError(null);
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
      <button type="button" className={className} onClick={go}>
        {children}
      </button>
      {error && (
        <span role="alert" className="text-sm font-semibold text-coral-deep">
          {error}
        </span>
      )}
    </>
  );
}

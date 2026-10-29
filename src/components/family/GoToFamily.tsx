"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Moves on to the family home a few seconds after the thank-you, so the parent sees their plan at work. */
export function GoToFamily({ afterMs = 4000 }: { afterMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace("/family"), afterMs);
    return () => clearTimeout(t);
  }, [router, afterMs]);
  return null;
}

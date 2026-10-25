"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EVERY_MS = 3000;
const TRIES = 20;

/** Back from Stripe before the payment is confirmed: checks again every few seconds for about a minute. */
export function PlanStarting() {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= TRIES) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, EVERY_MS);
    return () => clearTimeout(t);
  }, [tries, router]);
  return (
    <p role="status" className="rounded-2xl bg-sky/40 px-4 py-3" data-testid="plan-starting">
      {tries < TRIES ? (
        "Thank you! Your plan starts as soon as the payment goes through, usually within a minute. You can name your family while you wait."
      ) : (
        <>
          Your payment is taking longer than usual to confirm. Refresh in a minute, or check{" "}
          <Link href="/family/billing" className="font-semibold underline underline-offset-4">
            Plan and billing
          </Link>
          .
        </>
      )}
    </p>
  );
}

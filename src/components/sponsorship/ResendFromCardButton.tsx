"use client";

import { useState } from "react";
import { buttonSecondary } from "@/components/brand/buttons";

/** On the gift card's page: emails the family's invitation again, to the address the giver entered. */
export function ResendFromCardButton({ id, seat }: { id: string; seat: number }) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");
  async function resend() {
    setState("busy");
    setError("");
    const res = await fetch("/api/sponsorships/card-resend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, seat }) }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { error?: { message?: string } } | undefined;
    if (res?.ok) return setState("sent");
    setState("idle");
    setError(json?.error?.message ?? "Something went wrong. Please try again.");
  }
  if (state === "sent") {
    return (
      <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">
        Sent! Check your inbox, and your spam folder, for an email from Readli in the next few minutes.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" className={buttonSecondary} disabled={state === "busy"} onClick={resend}>
        {state === "busy" ? "Sending…" : "Send my invitation again"}
      </button>
      {error && (
        <p role="alert" className="rounded-2xl bg-coral/20 px-4 py-3 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

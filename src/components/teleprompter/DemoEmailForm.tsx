"use client";

import { useState } from "react";
import { buttonSecondary } from "@/components/brand/buttons";

type State = "idle" | "sending" | "sent";

/**
 * "Email me my demo" after a guest hears their first sample. Optional: nothing else on /try waits on it.
 * Emailing the demo and Readli news are two separate boxes, and news is unticked.
 */
export function DemoEmailForm() {
  const [email, setEmail] = useState("");
  const [deliveryConsent, setDeliveryConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <p role="status" className="rounded-2xl bg-surface p-4 font-semibold" data-testid="demo-email-sent">
        Sent. Check your inbox for a link to hear your demo again.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/guest/demo-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, deliveryConsent, marketing }),
      });
      if (res.ok) return setState("sent");
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      setError(body.error?.message ?? "We couldn't email your demo. Please try again.");
    } catch {
      setError("We couldn't email your demo. Please try again.");
    }
    setState("idle");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-surface p-4" data-testid="demo-email-form">
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Email me my demo</span>
        <span className="text-sm text-muted">Optional. We&apos;ll send a private link that works until your demo is deleted.</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-xl border-2 border-ink/15 bg-white px-3"
          aria-label="Your email address"
        />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" required checked={deliveryConsent} onChange={(e) => setDeliveryConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-coral-deep" />
        <span>Email me this demo. Readli sends one email, and deletes your address with the demo unless you also ask for news below.</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-coral-deep" />
        <span>Also send me Bedtime Thursdays and Readli news. You can unsubscribe any time.</span>
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-coral-deep">
          {error}
        </p>
      )}
      <button type="submit" disabled={state === "sending" || !deliveryConsent} className={buttonSecondary}>
        {state === "sending" ? "Sending…" : "Email my demo"}
      </button>
    </form>
  );
}

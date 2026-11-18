"use client";

import { useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";

/** One question from a feedback email: a 0 to 10 score (FB1) or what got in the way (W2), plus an optional comment. */
export function FeedbackForm({ token, ask, reasons }: { token: string; ask: "FB1" | "W2"; reasons: { id: string; label: string }[] }) {
  const [score, setScore] = useState<number | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "done") {
    return (
      <p role="status" className="text-lg" data-testid="feedback-thanks">
        Thank you. Every answer is read, and it helps us make Readli better for families.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ t: token, score, reason, comment }),
    }).catch(() => null);
    if (res?.ok) return setState("done");
    const body = (await res?.json().catch(() => ({}))) as { error?: { message?: string } } | undefined;
    setError(body?.error?.message ?? "We couldn't save that. Please try again.");
    setState("idle");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" data-testid="feedback-form">
      {ask === "FB1" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">How likely are you to recommend Readli to another family?</legend>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                aria-pressed={score === n}
                onClick={() => setScore(n)}
                className={`grid size-11 place-items-center rounded-full border-2 font-semibold ${score === n ? "border-ink bg-ink text-white" : "border-ink/20 bg-surface"}`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-sm text-muted">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">What got in the way?</legend>
          {reasons.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-3">
              <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="size-5 accent-coral-deep" />
              {r.label}
            </label>
          ))}
        </fieldset>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Anything else you&apos;d like to tell us? (optional)</span>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} rows={4} className="rounded-xl border-2 border-ink/15 bg-white p-3" />
      </label>
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
      <button type="submit" disabled={state === "sending"} className={`${buttonPrimary} self-start`}>
        {state === "sending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

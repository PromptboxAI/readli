"use client";

import { useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import { REPORT_REASONS, type ReportReason } from "@/lib/invitations/invitations";

const COPY = {
  decline: { button: "Decline this invitation", done: "Done. You won't get another invitation from this person." },
  unsubscribe: { button: "Stop all Readli invitations", done: "Done. Readli won't send invitations to this address again." },
  report: { button: "Send report", done: "Thank you. We'll look into it, and Readli won't send invitations to this address again." },
} as const;

/** Decline, unsubscribe or report, confirmed with a button so link scanners can't do it by visiting. */
export function RespondForm({ token, action }: { token: string; action: keyof typeof COPY }) {
  const [reason, setReason] = useState<ReportReason>("dont_know");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const res = await fetch("/api/invitations/respond", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, action, reason, details }) }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }
  if (state === "done")
    return (
      <p role="status" className="rounded-2xl bg-mint/60 p-4 text-lg" data-testid="respond-done">
        {COPY[action].done}
      </p>
    );
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" data-testid="respond-form">
      {action === "report" && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-semibold">What&apos;s wrong?</legend>
            {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => (
              <label key={r} className="flex items-center gap-3">
                <input type="radio" name="reason" className="size-5 accent-coral-deep" checked={reason === r} onChange={() => setReason(r)} />
                {REPORT_REASONS[r]}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Anything else we should know? (optional)</span>
            <textarea className="rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/20" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </label>
        </>
      )}
      <button className={`${buttonPrimary} w-fit`} disabled={state === "busy"}>
        {COPY[action].button}
      </button>
      {state === "error" && (
        <p role="alert" className="text-coral-deep">
          That didn&apos;t work. Please try again.
        </p>
      )}
    </form>
  );
}

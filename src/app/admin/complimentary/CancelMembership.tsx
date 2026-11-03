"use client";

import { useState, useTransition } from "react";
import { cancelMembershipAction, type RowResult } from "./actions";

/** Cancels a claimed complimentary membership after a confirm, and says what happened. */
export function CancelMembership({ giftId, certificate, who }: { giftId: string; certificate: string; who: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<RowResult>(null);
  if (result && "message" in result) return <span className="text-xs">{result.message}</span>;
  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className="min-h-11 whitespace-nowrap font-bold text-coral-deep underline"
        onClick={() => {
          if (!window.confirm(`Cancel ${certificate} for ${who}? The time they haven't used yet comes off their Readli Family, and any membership stacked after it moves earlier. This can't be undone.`)) return;
          start(async () => setResult(await cancelMembershipAction(giftId)));
        }}
      >
        {pending ? "Cancelling…" : "Cancel"}
      </button>
      {result && "error" in result && (
        <span role="alert" className="text-xs text-coral-deep">
          {result.error}
        </span>
      )}
    </span>
  );
}

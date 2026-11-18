"use client";

import { useActionState } from "react";
import { buttonSecondary } from "@/components/brand/buttons";
import { emailBatchAction, type RowResult } from "../actions";

/** Sends every unclaimed code and link in this batch to whoever hands them out, usually the organizer. */
export function EmailBatchForm({ batchId, unclaimed }: { batchId: string; unclaimed: number }) {
  const [result, action, pending] = useActionState<RowResult, FormData>(emailBatchAction.bind(null, batchId), null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="handout-to" className="font-bold">
        Email the {unclaimed} unclaimed {unclaimed === 1 ? "membership" : "memberships"} to the organizer
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="handout-to"
          name="to"
          type="email"
          required
          maxLength={254}
          placeholder="organizer@example.org"
          className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/20 focus:ring-ink"
        />
        <button className={buttonSecondary} disabled={pending}>
          {pending ? "Sending…" : "Email them"}
        </button>
      </div>
      <p className="text-sm">Each membership&apos;s code and one-time link, for them to hand to the winners.</p>
      {result && "error" in result && (
        <p role="alert" className="rounded-2xl bg-coral/30 px-4 py-3">
          {result.error}
        </p>
      )}
      {result && "message" in result && (
        <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">
          {result.message}
        </p>
      )}
    </form>
  );
}

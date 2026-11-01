"use client";

import { useId, useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import { FilePicker } from "@/components/donations/FilePicker";

/** The applicant's answer when Readli asks for more information: a note and an optional document. */
export function ReplyForm({ token }: { token: string }) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/donations/status/${encodeURIComponent(token)}/reply`, { method: "POST", body: new FormData(e.currentTarget) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(body?.error?.message ?? "We couldn't send your reply. Please try again.");
    setSent(true);
  }

  if (sent) {
    return (
      <p role="status" className="rounded-2xl bg-mint/50 p-4 font-semibold">
        Thanks! Your reply is with our team, and we&apos;ll email you once we&apos;ve reviewed it.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Reply to Readli">
      <label htmlFor={`${id}-reply`} className="font-semibold">
        Your reply
      </label>
      <textarea id={`${id}-reply`} name="reply" maxLength={2000} className="min-h-32 rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/20 focus:ring-ink" />
      <FilePicker id={`${id}-doc`} name="document" label="Attach a document" hint="PDF or image, up to 10 MB." />
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
      <button type="submit" className={`${buttonPrimary} sm:self-start`} disabled={busy}>
        {busy ? "Sending…" : "Send reply"}
      </button>
    </form>
  );
}

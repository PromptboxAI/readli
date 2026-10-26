"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";

/** Names (or renames) the family, as setup's first step after Family checkout. */
export function NameFamily({ current }: { current: string }) {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/family/household", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error?.message ?? "We couldn't save that name. Please try again.");
      return;
    }
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2" aria-label="Name your family">
      <label htmlFor={`${id}-name`} className="font-semibold">
        Family name
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`${id}-name`}
          className="min-h-12 w-full max-w-sm flex-1 rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink"
          value={name}
          placeholder="The Godfrey Family"
          autoComplete="off"
          maxLength={60}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className={buttonPrimary} disabled={busy || !name.trim()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-sm text-muted">Your family name is for grown-ups. Kids see each storyteller by the name you give them, like Grandpa.</p>
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </form>
  );
}

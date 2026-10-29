"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";

/** A signed-in grown-up's first step: name the family they'll set up. Starts blank: we don't know their last name. */
export function CreateFamily() {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/family/household", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Something went wrong. Please try again.");
      return;
    }
    // A new family has no plan yet, so the next step is choosing one.
    router.push("/family/settings/plan");
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="font-display text-2xl font-semibold">
        Start your family
      </h2>
      <p>Give your family a name. You can invite others and add kids profiles next.</p>
      <label htmlFor={`${id}-name`} className="font-semibold">
        Family name
      </label>
      <input
        id={`${id}-name`}
        className="min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink"
        value={name}
        placeholder="The Godfrey Family"
        autoComplete="off"
        maxLength={60}
        required
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className={`${buttonPrimary} self-start`} disabled={busy}>
        Create our family
      </button>
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </form>
  );
}

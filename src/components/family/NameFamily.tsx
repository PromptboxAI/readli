"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import Link from "next/link";
import { buttonPrimary, parentPrimary, stepNext, stepRow } from "@/components/brand/buttons";

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
          className="min-h-11 w-full max-w-sm flex-1 rounded-xl border border-ink/25 bg-surface px-4 focus:border-ink"
          value={name}
          placeholder="The Godfrey Family"
          autoComplete="off"
          maxLength={60}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className={parentPrimary} disabled={busy || !name.trim()}>
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

/**
 * Family setup's "What's your family called?" screen, after Family checkout. Looks like the signup welcome's
 * family step (/start), but saves straight to the family, which checkout already started with a stand-in name.
 */
export function SetupFamilyName({ next, nextLabel, back }: { next: string; nextLabel: string; back: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/family/household", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      const body = await res?.json().catch(() => null);
      setError(body?.error?.message ?? "We couldn't save that name. Please try again.");
      return;
    }
    router.push(next);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10 sm:p-6" data-testid="setup-family-name-form">
      <label htmlFor="family-name" className="font-display text-xl font-semibold">
        Family name
      </label>
      <input
        id="family-name"
        className="min-h-14 w-full max-w-md rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-xl focus:border-ink"
        value={name}
        placeholder="The Godfrey Family"
        autoComplete="off"
        maxLength={60}
        required
        onChange={(e) => setName(e.target.value)}
      />
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
      <div className={`${stepRow} pt-2`}>
        <Link href={back} className="font-semibold underline underline-offset-4">
          Back
        </Link>
        <button type="submit" className={`${buttonPrimary} ${stepNext}`} disabled={busy || !name.trim()}>
          {busy ? "Saving…" : nextLabel}
        </button>
      </div>
    </form>
  );
}

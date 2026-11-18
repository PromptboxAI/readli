"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { buttonPrimary, stepNext } from "@/components/brand/buttons";
import { saveNameAndContinue } from "@/lib/account/actions";

/**
 * Asks a grown-up what to call them, right where they'd otherwise be greeted by their email address.
 * Saves to the same name Account settings changes, so the greeting, the menu and invitations all use it.
 */
export function AskName({
  label = "What should we call you?",
  hint = "This is how you'll appear to your kids and storytellers.",
  placeholder = "Mom, Dad, Grandpa Kevin…",
  initial = "",
  next,
  submitLabel = "Save",
}: {
  label?: string;
  hint?: string;
  placeholder?: string;
  /** The name they have now (say, from their Google profile), to keep or change. */
  initial?: string;
  /** Inside a walkthrough: go on to this page once saved, instead of staying here. */
  next?: string;
  submitLabel?: string;
} = {}) {
  const id = useId();
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moving, startMoving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    if (next) {
      // One request saves the name and brings back the next step, instead of a save and then a separate page load.
      // A save that worked ends in a redirect, which the transition hands to the router.
      startMoving(async () => {
        try {
          const result = await saveNameAndContinue(name.trim(), next);
          setError(result.error);
        } catch (err) {
          unstable_rethrow(err);
          setError("We couldn't save your name. Please try again.");
        }
        setBusy(false);
      });
      return;
    }
    const res = await fetch("/api/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name.trim() }) }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      const body = await res?.json().catch(() => null);
      setError(body?.error?.message ?? "We couldn't save your name. Please try again.");
      return;
    }
    setBusy(false);
    setSaved(true);
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-3xl bg-sky/40 p-4 sm:p-5" aria-labelledby={`${id}-label`} data-testid="ask-name">
      <label id={`${id}-label`} htmlFor={`${id}-name`} className="font-display text-xl font-semibold">
        {label}
      </label>
      <p className="-mt-1 text-sm">{hint}</p>
      <div className={next ? "flex flex-col gap-3" : "flex flex-wrap gap-2"}>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder={placeholder}
          autoComplete="name"
          maxLength={60}
          required
          className={`min-h-12 w-full rounded-2xl ${next ? "" : "max-w-sm flex-1 "} border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink`}
        />
        {/* In a walkthrough the button moves the step forward, so it sits on the right (full width on a phone). */}
        <button type="submit" className={next ? `${buttonPrimary} ${stepNext}` : buttonPrimary} disabled={busy || moving || !name.trim()}>
          {busy || moving ? "Saving…" : submitLabel}
        </button>
      </div>
      <p role="status" aria-live="polite" className={saved ? "text-sm font-semibold" : "sr-only"}>
        {saved ? "Saved. You can change it any time in Settings." : ""}
      </p>
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </form>
  );
}

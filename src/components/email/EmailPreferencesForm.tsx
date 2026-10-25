"use client";

import { useId, useState } from "react";
import { buttonSecondary } from "@/components/brand/buttons";
import { PREFERENCE_TOPICS, type PreferenceTopic } from "@/lib/email/catalog";

const panel = "flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10";

/**
 * Which optional Readli emails a grown-up gets. Account, billing and invitation emails they asked for
 * always arrive. With a token it saves from the no-login preferences page; without, as the signed-in
 * grown-up.
 */
export function EmailPreferencesForm({ initial, token }: { initial: Record<PreferenceTopic, boolean>; token?: string }) {
  const id = useId();
  const [prefs, setPrefs] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    setError(null);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch("/api/email/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preferences: prefs, timeZone, ...(token ? { token } : {}) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setState("idle");
      setError((body?.error?.message as string | undefined) ?? "Something went wrong. Please try again.");
      return;
    }
    const body = (await res.json()) as { preferences: Record<PreferenceTopic, boolean> };
    setPrefs(body.preferences);
    setState("saved");
  };

  return (
    <form onSubmit={save} className={panel} aria-labelledby={`${id}-h`} data-testid="email-preferences">
      <h2 id={`${id}-h`} className="font-display text-2xl font-semibold">
        Email
      </h2>
      <p>Emails about your account, billing and invitations you asked for always arrive. Choose which others you get.</p>
      {PREFERENCE_TOPICS.map(({ topic, label, hint }) => (
        <label key={topic} className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-ink"
            checked={prefs[topic]}
            onChange={(e) => {
              setPrefs({ ...prefs, [topic]: e.target.checked });
              setState("idle");
            }}
          />
          <span>
            <span className="font-semibold">{label}</span>
            <span className="block text-sm text-muted">{hint}</span>
          </span>
        </label>
      ))}
      <button type="submit" className={`${buttonSecondary} self-start`} disabled={state === "saving"}>
        {state === "saving" ? "Saving…" : "Save email settings"}
      </button>
      {state === "saved" && (
        <p role="status" className="font-semibold">
          Saved.
        </p>
      )}
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </form>
  );
}

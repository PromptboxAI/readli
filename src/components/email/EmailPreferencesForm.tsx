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

/** The signed-in grown-up's optional emails in Settings: one switch per row, each saved as it's flipped. */
export function EmailToggles({ initial }: { initial: Record<PreferenceTopic, boolean> }) {
  const id = useId();
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState<PreferenceTopic | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flip = async (topic: PreferenceTopic, on: boolean) => {
    const before = prefs;
    const next = { ...prefs, [topic]: on };
    setPrefs(next);
    setSaving(topic);
    setMessage(null);
    setError(null);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch("/api/email/preferences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ preferences: next, timeZone }) });
    setSaving(null);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setPrefs(before);
      setError((body?.error?.message as string | undefined) ?? "Something went wrong. Please try again.");
      return;
    }
    const body = (await res.json()) as { preferences: Record<PreferenceTopic, boolean> };
    setPrefs(body.preferences);
    setMessage("Saved.");
  };

  return (
    <section className="divide-y-2 divide-ink/5 rounded-3xl bg-surface ring-2 ring-ink/10" aria-labelledby={`${id}-h`} data-testid="email-preferences">
      <div className="px-4 py-3">
        <h2 id={`${id}-h`} className="text-sm font-bold tracking-wider text-muted uppercase">
          Emails
        </h2>
        <p className="text-sm text-muted">Emails about your account, billing and invitations you asked for always arrive.</p>
      </div>
      {PREFERENCE_TOPICS.map(({ topic, label, hint }) => (
        <label key={topic} className="flex cursor-pointer items-center gap-4 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{label}</span>
            <span className="block text-sm text-muted">{hint}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={prefs[topic]}
            disabled={saving !== null}
            onChange={(e) => void flip(topic, e.target.checked)}
          />
          <span
            aria-hidden="true"
            className="relative h-7 w-12 shrink-0 rounded-full bg-ink/20 transition-colors peer-checked:bg-mint-deep peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-coral-deep after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-surface after:shadow after:transition-transform peer-checked:after:translate-x-5 motion-reduce:transition-none motion-reduce:after:transition-none"
          />
        </label>
      ))}
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
      {error && (
        <p role="alert" className="px-4 py-3 font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </section>
  );
}

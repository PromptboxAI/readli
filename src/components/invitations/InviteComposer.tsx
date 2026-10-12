"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { MESSAGE_MAX, SEND_RESULT_MESSAGES, normalizeEmail, type SendResult } from "@/lib/invitations/invitations";

const RELATIONSHIPS = ["Son or daughter", "Grandchild's parent", "Husband or wife", "Significant other", "Partner", "Sibling", "Niece or nephew", "Friend of the family", "Other"];
const field = "w-full rounded-2xl bg-surface px-4 py-3 ring-2 ring-ink/20 focus:outline-none focus:ring-ink";

interface Row {
  name: string;
  relationship: string;
  email: string;
}

const blank = (): Row => ({ name: "", relationship: "", email: "" });

/** Invite adult family members by email. Nothing is read from the contributor's contacts. */
export function InviteComposer({ maxPerSend, linkDays, shareConsent, adultsConsent, disabled }: { maxPerSend: number; linkDays: number; shareConsent: string; adultsConsent: string; disabled: string | null }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [message, setMessage] = useState("");
  const [adults, setAdults] = useState(false);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ email: string; name: string; result: SendResult | "failed" }[] | null>(null);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.email.trim());
  const bad = filled.filter((r) => !normalizeEmail(r.email));
  const ready = !disabled && adults && share && filled.length > 0 && bad.length === 0 && !busy;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipients: filled, message, adultsConfirmed: adults, shareConsent: share }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "We couldn't send your invitations. Please try again.");
      setResults(data.results);
      setRows([blank()]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send your invitations. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-6 rounded-[var(--radius-panel)] bg-sky/30 p-5 sm:p-8" onSubmit={send} data-testid="invite-composer">
      <fieldset className="flex flex-col gap-4" disabled={Boolean(disabled)}>
        <legend className="mb-3 font-display text-xl font-semibold">Who would you like to invite?</legend>
        {rows.map((r, i) => (
          <div key={i} className="grid gap-3 rounded-3xl bg-surface/70 p-4 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-semibold">Name (optional)</span>
              <input className={field} value={r.name} maxLength={80} onChange={(e) => set(i, { name: e.target.value })} autoComplete="off" />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-semibold">Relationship (optional)</span>
              <select className={field} value={r.relationship} onChange={(e) => set(i, { relationship: e.target.value })}>
                <option value="">Choose…</option>
                {RELATIONSHIPS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-semibold">Email</span>
              <input
                className={field}
                type="email"
                value={r.email}
                onChange={(e) => set(i, { email: e.target.value })}
                placeholder="name@example.com"
                autoComplete="off"
                aria-invalid={Boolean(r.email.trim()) && !normalizeEmail(r.email)}
              />
            </label>
            <button type="button" className={`${buttonQuiet} min-h-11 px-3 text-base`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blank()]))} aria-label={`Remove person ${i + 1}`}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className={`${buttonSecondary} w-fit`} disabled={rows.length >= maxPerSend} onClick={() => setRows((rs) => [...rs, blank()])}>
          Add another person
        </button>
        <p className="text-sm text-muted">Up to {maxPerSend} people at a time. Readli never looks at or emails your contacts.</p>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-display text-xl font-semibold">A note from you (optional)</span>
        <textarea className={field} rows={3} maxLength={MESSAGE_MAX} value={message} onChange={(e) => setMessage(e.target.value)} disabled={Boolean(disabled)} />
        <span className="text-sm text-muted">Shown in the email and on your preview page.</span>
      </label>

      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3 rounded-2xl bg-surface p-4">
          <input type="checkbox" className="mt-1 size-5 shrink-0 accent-coral-deep" checked={adults} onChange={(e) => setAdults(e.target.checked)} disabled={Boolean(disabled)} />
          <span>{adultsConsent}</span>
        </label>
        <label className="flex items-start gap-3 rounded-2xl bg-surface p-4">
          <input type="checkbox" className="mt-1 size-5 shrink-0 accent-coral-deep" checked={share} onChange={(e) => setShare(e.target.checked)} disabled={Boolean(disabled)} />
          <span>{shareConsent}</span>
        </label>
      </div>

      {bad.length > 0 && <p className="text-coral-deep">Check {bad.length === 1 ? "that email address" : "those email addresses"}.</p>}
      {error && (
        <p role="alert" className="text-coral-deep">
          {error}
        </p>
      )}
      {disabled && <p className="rounded-2xl bg-lavender/40 px-4 py-3 text-sm">{disabled}</p>}
      {results && (
        <ul className="flex flex-col gap-1 rounded-2xl bg-mint/50 p-4" data-testid="send-results" aria-live="polite">
          {results.map((r) => (
            <li key={r.email}>
              <span className="font-semibold">{r.name || r.email}</span>:{" "}
              {r.result === "created" ? "invitation sent" : r.result === "failed" ? "we couldn't send this one. Try resending below" : SEND_RESULT_MESSAGES[r.result]}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button className={buttonPrimary} disabled={!ready} data-testid="send-invitations">
          {busy ? "Sending…" : "Send invitations"}
        </button>
        <p className="text-sm text-muted">Links expire after {linkDays} days. Each person can decline or unsubscribe in one tap.</p>
      </div>
    </form>
  );
}

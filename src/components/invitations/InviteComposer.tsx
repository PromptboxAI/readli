"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonPrimary, buttonQuiet } from "@/components/brand/buttons";
import { DEFAULT_CONTRIBUTOR_MESSAGE, MESSAGE_MAX, SEND_RESULT_MESSAGES, normalizeEmail, type SendResult } from "@/lib/invitations/invitations";
import { PlayButton } from "./PlayButton";

const RELATIONSHIPS = ["Son or daughter", "Grandchild's parent", "Husband or wife", "Significant other", "Partner", "Sibling", "Niece or nephew", "Friend of the family", "Other"];
const field = "min-h-12 w-full rounded-2xl bg-surface px-4 py-2.5 text-lg ring-2 ring-ink/20 focus:outline-none focus:ring-ink";

interface Row {
  name: string;
  relationship: string;
  email: string;
}

const blank = (): Row => ({ name: "", relationship: "", email: "" });

export interface ComposerPreview {
  id: string;
  title: string;
  coverUrl: string | null;
}

/**
 * Step two of sharing: who should hear it. One family by default, with more on request; only the
 * email is required. The two sharing statements sit in one checkbox, word for word, and both are
 * recorded with the send. Nothing is read from the contributor's contacts. A send that reaches
 * anyone goes on to the sent screen; one that reaches nobody stays here and says why.
 */
export function InviteComposer({
  maxPerSend,
  linkDays,
  shareConsent,
  adultsConsent,
  disabled,
  preview,
  changeHref,
  sentHref,
}: {
  maxPerSend: number;
  linkDays: number;
  shareConsent: string;
  adultsConsent: string;
  disabled: string | null;
  preview: ComposerPreview | null;
  changeHref: string;
  sentHref: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState<{ email: string; name: string; result: SendResult | "failed" }[] | null>(null);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.email.trim());
  const bad = filled.filter((r) => !normalizeEmail(r.email));
  const ready = !disabled && agreed && filled.length > 0 && bad.length === 0 && !busy;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    setSkipped(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipients: filled, message, adultsConfirmed: agreed, shareConsent: agreed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "We couldn't send your invitations. Please try again.");
      const results = (data.results ?? []) as { email: string; name: string; result: SendResult | "failed" }[];
      const created = results.filter((r) => r.result === "created").length;
      const notSent = results.filter((r) => r.result !== "created" && r.result !== "duplicate");
      if (created > 0) {
        router.push(`${sentHref}${notSent.length ? `&skipped=${notSent.length}` : ""}`);
        return;
      }
      setSkipped(notSent);
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send your invitations. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form className="flex max-w-2xl flex-col gap-5" onSubmit={send} data-testid="invite-composer">
      {preview && (
        <div className="flex items-center gap-3 rounded-3xl bg-sky/40 p-3" data-testid="composer-preview">
          {preview.coverUrl && <Image src={preview.coverUrl} alt="" width={48} height={64} className="h-16 w-12 shrink-0 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1">
            <PlayButton label={`Hear yourself read ${preview.title}`} endpoint={`/api/invitations/preview/${preview.id}`} />
          </div>
          <Link href={changeHref} className="shrink-0 px-2 font-semibold underline underline-offset-4">
            Change
          </Link>
        </div>
      )}

      <fieldset className="flex flex-col gap-4" disabled={Boolean(disabled)}>
        <legend className="sr-only">Who should hear it?</legend>
        {rows.map((r, i) => (
          <div key={i} className={`flex flex-col gap-3 ${rows.length > 1 ? "rounded-3xl bg-surface/70 p-4 ring-2 ring-ink/10" : ""}`} data-testid="recipient">
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Their email</span>
              <input
                className={field}
                type="email"
                value={r.email}
                onChange={(e) => set(i, { email: e.target.value })}
                placeholder="name@example.com"
                autoComplete="off"
                inputMode="email"
                aria-invalid={Boolean(r.email.trim()) && !normalizeEmail(r.email)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold">
                  Name <span className="font-normal text-muted">(optional)</span>
                </span>
                <input className={field} value={r.name} maxLength={80} onChange={(e) => set(i, { name: e.target.value })} autoComplete="off" />
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold">
                  They&apos;re my <span className="font-normal text-muted">(optional)</span>
                </span>
                <select className={field} value={r.relationship} onChange={(e) => set(i, { relationship: e.target.value })}>
                  <option value="">Choose…</option>
                  {RELATIONSHIPS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
            {rows.length > 1 && (
              <button type="button" className={`${buttonQuiet} min-h-11 self-start px-0 text-base`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove family ${i + 1}`}>
                Remove
              </button>
            )}
          </div>
        ))}
        {rows.length < maxPerSend && (
          <button type="button" className="min-h-11 self-start font-display font-semibold underline underline-offset-4" onClick={() => setRows((rs) => [...rs, blank()])}>
            + Add another family
          </button>
        )}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="font-semibold">
          A note <span className="font-normal text-muted">(optional)</span>
        </span>
        <textarea className={field} rows={2} maxLength={MESSAGE_MAX} value={message} onChange={(e) => setMessage(e.target.value)} disabled={Boolean(disabled)} placeholder={DEFAULT_CONTRIBUTOR_MESSAGE} />
      </label>

      <label className="flex items-start gap-3 rounded-2xl bg-lavender/40 p-4">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-coral-deep" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={Boolean(disabled)} />
        <span className="text-sm leading-relaxed">
          {adultsConsent} {shareConsent}
        </span>
      </label>

      {bad.length > 0 && <p className="text-coral-deep">Check {bad.length === 1 ? "that email address" : "those email addresses"}.</p>}
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
      {skipped && (
        <ul role="alert" className="flex flex-col gap-1 rounded-2xl bg-sunshine/50 p-4" data-testid="send-results">
          {skipped.map((r) => (
            <li key={r.email}>
              <span className="font-semibold">{r.name || r.email}</span>: {r.result === "failed" ? "we couldn't send this one. Please try again." : SEND_RESULT_MESSAGES[r.result as Exclude<SendResult, "created">]}
            </li>
          ))}
        </ul>
      )}
      {disabled && <p className="rounded-2xl bg-lavender/40 px-4 py-3 text-sm">{disabled}</p>}

      <button className={`${buttonPrimary} w-full sm:w-fit`} disabled={!ready} data-testid="send-invitations">
        {busy ? "Sending…" : filled.length > 1 ? "Send Invitations" : "Send Invitation"}
      </button>
      <p className="-mt-2 text-sm text-muted">The link works for {linkDays} days. They can decline or unsubscribe in one tap.</p>
    </form>
  );
}

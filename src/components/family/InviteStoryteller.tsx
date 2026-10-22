"use client";

import { useId, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { RELATIONSHIPS, type FamilyInvite } from "@/lib/invites/family-invites";

export type SavedInvite = Omit<FamilyInvite, "createdAt"> & { createdAt: string | Date };

const field = "min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink";

/**
 * Family storytellers → Invite a storyteller. Live: saves the invitation and returns a single-use link
 * (email sending isn't switched on yet, so the parent sends it). Preview: nothing is saved or sent.
 * Inviting never uses a narrator slot and shares nothing.
 */
export function InviteStoryteller({ live, initialName = "", onSent, onClose }: { live: boolean; initialName?: string; onSent: (invite: SavedInvite) => void; onClose: () => void }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [name, setName] = useState(initialName);
  const [relationship, setRelationship] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ name: string; link: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const emailOk = email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = !busy && emailOk && (email.trim() !== "" || name.trim() !== "");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setError("");
    if (!live) {
      const invite: SavedInvite = { id: `preview-${Date.now()}`, name: name.trim() || email.trim().split("@")[0]!, relationship, email: null, status: "invited", createdAt: new Date() };
      onSent(invite);
      setSent({ name: invite.name, link: null });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name, relationship }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "That didn't work. Please try again.");
      onSent(body.invite as SavedInvite);
      setSent({ name: body.invite.name as string, link: body.link as string });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function share(link: string, who: string) {
    const text = `I'd love you to read stories to our kids on Readli. Make a free account, record your voice and share it with our family here: ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: `Read stories to our family, ${who}`, text });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      }
    } catch {
      /* Share sheet dismissed. */
    }
  }

  if (sent) {
    return (
      <section aria-live="polite" className="flex flex-col items-start gap-3 rounded-3xl bg-mint/50 p-5" data-testid="invite-sent">
        <h3 className="font-display text-2xl font-semibold">Invitation ready for {sent.name}</h3>
        {sent.link ? (
          <>
            <p>Email sending isn&apos;t switched on yet, so send {sent.name} this private link by text or email. It works once and expires in 14 days.</p>
            <p className="w-full break-all rounded-2xl bg-surface p-3 font-mono text-sm" data-testid="invite-link">
              {sent.link}
            </p>
            <button type="button" className={buttonPrimary} onClick={() => share(sent.link!, sent.name)}>
              {copied ? "Link copied" : "Share the link"}
            </button>
          </>
        ) : (
          <p>This is a preview, so nothing was sent.</p>
        )}
        <p className="text-sm text-muted">No narrator slot is used until you add {sent.name}. We&apos;ll show each step below.</p>
        <button type="button" className={buttonSecondary} onClick={onClose}>
          Done
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-5 rounded-3xl bg-surface p-5 ring-2 ring-ink/10" aria-label="Invite a storyteller" data-testid="invite-form">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-2xl font-semibold">Invite a storyteller</h3>
        <p className="text-muted">They make a free Readli Voice account, record their own voice and choose to share it with your family. They never pay.</p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-email`} className="font-display text-lg font-semibold">
          Their email
        </label>
        <input id={`${id}-email`} type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" aria-invalid={!emailOk} />
        {!emailOk && <p className="text-sm font-semibold text-coral-deep">Check the email address.</p>}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-name`} className="font-display text-lg font-semibold">
          Their name <span className="font-sans text-base font-normal text-muted">(optional)</span>
        </label>
        <input id={`${id}-name`} className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Grandma June" autoComplete="off" />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-display text-lg font-semibold">
          They are your kids&apos;… <span className="font-sans text-base font-normal text-muted">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIPS.map((r) => (
            <label key={r} className={`cursor-pointer rounded-full px-4 py-2 font-display ring-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-coral-deep ${relationship === r ? "bg-ink text-white ring-ink" : "bg-ivory ring-ink/15"}`}>
              <input type="radio" name={`${id}-relationship`} value={r} checked={relationship === r} onChange={() => setRelationship(r)} className="sr-only" />
              {r}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="rounded-2xl bg-coral/30 p-3 font-semibold">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonPrimary} disabled={!canSend}>
          {busy ? "Creating invitation…" : "Create invitation"}
        </button>
        <button type="button" className={buttonSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
      <p className="text-sm text-muted">Inviting doesn&apos;t use a narrator slot, and nothing is shared until they say yes.</p>
    </form>
  );
}

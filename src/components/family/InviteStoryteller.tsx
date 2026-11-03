"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { parentPrimary, parentSecondary } from "@/components/brand/buttons";
import { HelpLink } from "@/components/help/HelpLink";
import type { FamilyInvite } from "@/lib/invites/family-invites";
import { RelationshipPicker } from "./RelationshipPicker";

/** Why an invitation wasn't emailed; mirrors EMAIL_MESSAGES on the server. */
const NOT_EMAILED: Record<string, string> = {
  suppressed: "asked not to get Readli invitations, so we didn't email them.",
  daily_limit: "wasn't emailed because you've reached today's email limit.",
  failed: "wasn't emailed because something went wrong on our side.",
};

export type SavedInvite = Omit<FamilyInvite, "createdAt"> & { createdAt: string | Date };

const field = "min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink";

/**
 * Family storytellers → Invite a storyteller. Live: saves the invitation and returns a single-use link
 * (email sending isn't switched on yet, so the parent sends it). Preview: nothing is saved or sent.
 * Inviting never holds or uses a narrator slot and shares nothing.
 */
/** Where to invite a partner instead, and whether this parent may (only the plan's owner invites co-parents). */
export interface CoParentOption {
  href: string;
  canInvite: boolean;
  ownerName: string;
}

export function InviteStoryteller({
  live,
  initialName = "",
  coParent = null,
  onSent,
  onClose,
}: {
  live: boolean;
  initialName?: string;
  /** Shows "Who are you inviting?" so a parent doesn't invite their partner as a voice-only storyteller. */
  coParent?: CoParentOption | null;
  onSent: (invite: SavedInvite) => void;
  onClose: () => void;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [name, setName] = useState(initialName);
  const [relationship, setRelationship] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ name: string; link: string | null; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const emailOk = email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = !busy && emailOk && (email.trim() !== "" || name.trim() !== "");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setError("");
    if (!live) {
      const invite: SavedInvite = { id: `preview-${Date.now()}`, name: name.trim() || email.trim().split("@")[0]!, relationship: relationship.trim(), email: null, status: "invited", createdAt: new Date() };
      onSent(invite);
      setSent({ name: invite.name, link: null, email: "off" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name, relationship }) });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "That didn't work. Please try again.");
      onSent(body.invite as SavedInvite);
      setSent({ name: body.invite.name as string, link: body.link as string, email: typeof body.email === "string" ? body.email : "off" });
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
            {sent.email === "sent" ? (
              <p data-testid="invite-emailed">We emailed {sent.name} the invitation. You can also send them this private link yourself. It works once and expires in 14 days.</p>
            ) : sent.email in NOT_EMAILED ? (
              <p>
                {sent.name} {NOT_EMAILED[sent.email]} You can send them this private link by text or email. It works once and expires in 14 days.
              </p>
            ) : (
              <p>Email sending isn&apos;t switched on yet, so send {sent.name} this private link by text or email. It works once and expires in 14 days.</p>
            )}
            <p className="w-full break-all rounded-2xl bg-surface p-3 font-mono text-sm" data-testid="invite-link">
              {sent.link}
            </p>
            <button type="button" className={parentPrimary} onClick={() => share(sent.link!, sent.name)}>
              {copied ? "Link copied" : "Share the link"}
            </button>
          </>
        ) : (
          <p>This is a preview, so nothing was sent.</p>
        )}
        <p className="text-sm">
          Prefer paper?{" "}
          <Link href="/help/print/record-your-voice" target="_blank" className="font-semibold underline underline-offset-4" data-testid="print-recording-guide">
            Print the recording steps for {sent.name}
          </Link>
        </p>
        <p className="text-sm text-muted">No narrator slot is used until you add {sent.name}. We&apos;ll show each step below.</p>
        <button type="button" className={parentSecondary} onClick={onClose}>
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
      {coParent && <WhoToInvite coParent={coParent} />}
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
      <RelationshipPicker
        legend={
          <>
            They are your kids&apos;… <span className="font-sans text-base font-normal text-muted">(optional)</span>
          </>
        }
        value={relationship}
        onChange={setRelationship}
      />
      {error && (
        <p role="alert" className="rounded-2xl bg-coral/30 p-3 font-semibold">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={parentPrimary} disabled={!canSend}>
          {busy ? "Creating invitation…" : "Create invitation"}
        </button>
        <button type="button" className={parentSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
      <p className="text-sm text-muted">
        Inviting doesn&apos;t use a narrator slot, and nothing is shared until they say yes.{" "}
        <HelpLink slug="invite-relatives-elsewhere">Inviting relatives who live elsewhere</HelpLink>
      </p>
    </form>
  );
}

/**
 * The two kinds of invitation side by side. A storyteller only lends their voice; a partner or co-parent
 * runs the family account with you. Inviting a partner here would leave them without parent controls.
 */
function WhoToInvite({ coParent }: { coParent: CoParentOption }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Who are you inviting?" data-testid="who-to-invite">
      <h4 className="font-display text-lg font-semibold">Who are you inviting?</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-2xl bg-mint/40 p-4 ring-2 ring-ink/20" data-testid="invite-kind-storyteller">
          <p className="font-display text-lg font-semibold">
            A storyteller <span className="font-sans text-sm font-bold text-muted">· this form</span>
          </p>
          <p className="text-sm">For grandparents, aunts, uncles and friends. Voice only.</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            <li>Records their voice for free from their own phone.</li>
            <li>You add them to a narrator slot and choose which kids hear them.</li>
            <li>Can&apos;t see your family account, your kids&apos; profiles or your books.</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-sky/30 p-4" data-testid="invite-kind-co-parent">
          <p className="font-display text-lg font-semibold">Your partner or co-parent</p>
          <p className="text-sm">For mom, dad or another parent at home. Full parent access.</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            <li>Signs in as a second parent and sees the whole family account.</li>
            <li>Prepares books, chooses storytellers and runs Readli Kids on their own devices.</li>
            <li>Can record their own voice too. Everything except billing.</li>
          </ul>
          {coParent.canInvite ? (
            <Link href={coParent.href} className="mt-1 font-display font-semibold underline underline-offset-4" data-testid="invite-co-parent-link">
              Invite a co-parent instead
            </Link>
          ) : (
            <p className="mt-1 text-sm font-semibold">Only {coParent.ownerName} can invite another parent.</p>
          )}
        </div>
      </div>
    </section>
  );
}

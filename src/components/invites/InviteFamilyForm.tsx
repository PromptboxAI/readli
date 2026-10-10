"use client";

import { useId, useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { INVITE_STATUS, inviteMessage, RELATIONSHIPS, type FamilyInvite } from "@/lib/invites/family-invites";

const SAMPLE: FamilyInvite[] = [
  { id: "s1", name: "Grandma June", relationship: "Grandma", email: null, status: "ready_shared", createdAt: new Date("2026-09-30") },
  { id: "s2", name: "Grandpa Lou", relationship: "Grandpa", email: null, status: "invited", createdAt: new Date("2026-10-08") },
  { id: "s3", name: "Aunt Priya", relationship: "Aunt", email: null, status: "joined_no_voice", createdAt: new Date("2026-10-02") },
];

const STATUS_TINT: Record<FamilyInvite["status"], string> = {
  invited: "bg-sunshine",
  joined_no_voice: "bg-sky/60",
  recording: "bg-sky/60",
  pending_verification: "bg-lavender",
  ready_shared: "bg-mint",
  revoked: "bg-surface ring-2 ring-ink/20",
  expired: "bg-surface ring-2 ring-ink/20",
};

const field = "min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink";

export function InviteFamilyForm({ fromName = "Sara" }: { fromName?: string }) {
  const id = useId();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<string>("Grandma");
  const [how, setHow] = useState<"link" | "email">("link");
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState(SAMPLE);
  const [sent, setSent] = useState<FamilyInvite | null>(null);
  const [copied, setCopied] = useState(false);

  const message = inviteMessage({ from: fromName, to: name, relationship });
  const link = "https://readli.ai/signup?invite=preview";
  const canSend = name.trim().length > 0 && (how === "link" || /\S+@\S+\.\S+/.test(email));

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    const invite: FamilyInvite = {
      id: `new-${invites.length}`,
      name: name.trim(),
      relationship,
      email: how === "email" ? email.trim() : null,
      status: "invited",
      createdAt: new Date(),
    };
    setInvites([invite, ...invites]);
    setSent(invite);
    setCopied(false);
  }

  async function shareLink() {
    const text = `${message} ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: "Join our family on Readli", text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch {
      /* Share sheet dismissed. */
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      {sent ? (
        <section aria-live="polite" className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] bg-mint/50 p-6 sm:p-8">
          <ReadiMascot size={110} decorative />
          <h2 className="font-display text-3xl font-semibold">Invitation ready for {sent.name}</h2>
          <p>
            {sent.email ? `We'd email ${sent.email}.` : "Send this link however you like: text, WhatsApp or email."} When{" "}
            {sent.name} joins, they can record their voice and decide whether to share it with you.
          </p>
          <p className="rounded-2xl bg-surface p-4 text-sm">This is a preview, so nothing was sent.</p>
          <div className="flex flex-wrap gap-3">
            {!sent.email && (
              <button type="button" className={buttonPrimary} onClick={shareLink}>
                {copied ? "Link copied" : "Share the link"}
              </button>
            )}
            <button
              type="button"
              className={buttonSecondary}
              onClick={() => {
                setSent(null);
                setName("");
                setEmail("");
              }}
            >
              Invite someone else
            </button>
          </div>
        </section>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-6 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8" aria-label="Invite a family member">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-name`} className="font-display text-lg font-semibold">
              Who are you inviting?
            </label>
            <input id={`${id}-name`} className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Grandpa Lou" autoComplete="off" required />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="font-display text-lg font-semibold">They are your kids&apos;…</legend>
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIPS.map((r) => (
                <label key={r} className={`cursor-pointer rounded-full px-4 py-2 font-display ring-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-coral-deep ${relationship === r ? "bg-ink text-white ring-ink" : "bg-ivory ring-ink/15"}`}>
                  <input type="radio" name="relationship" value={r} checked={relationship === r} onChange={() => setRelationship(r)} className="sr-only" />
                  {r}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="font-display text-lg font-semibold">How should we send it?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["link", "Share a link"],
                  ["email", "Send an email"],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-2xl px-3 text-center font-display ring-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-coral-deep ${how === v ? "bg-sky/60 ring-ink" : "bg-ivory ring-ink/15"}`}>
                  <input type="radio" name="how" value={v} checked={how === v} onChange={() => setHow(v)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
            {how === "email" && (
              <>
                <label htmlFor={`${id}-email`} className="mt-2 font-semibold">
                  Their email
                </label>
                <input id={`${id}-email`} type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
              </>
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            <p className="font-display text-lg font-semibold">What they&apos;ll read</p>
            <blockquote className="rounded-2xl bg-ivory p-4" data-testid="invite-preview">
              {message}
            </blockquote>
          </div>

          <button type="submit" className={buttonPrimary} disabled={!canSend}>
            {how === "email" ? "Send invitation" : "Create invite link"}
          </button>
          <p className="text-sm text-muted">Inviting is free. It doesn&apos;t start a subscription for them.</p>
        </form>
      )}

      <section aria-labelledby={`${id}-circle`} className="flex flex-col gap-4">
        <h2 id={`${id}-circle`} className="font-display text-2xl font-semibold">
          Your storytellers
        </h2>
        <ul className="flex flex-col gap-3" data-testid="invite-list">
          {invites.map((inv) => (
            <li key={inv.id} className="flex items-center gap-4 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
              <span aria-hidden="true" className={`grid size-12 shrink-0 place-items-center rounded-full font-display text-lg font-semibold ${STATUS_TINT[inv.status]}`}>
                {inv.name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-semibold">{inv.name}</span>
                <span className="block text-sm font-semibold">{INVITE_STATUS[inv.status].label}</span>
                <span className="block text-sm text-muted">{INVITE_STATUS[inv.status].next}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

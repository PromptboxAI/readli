"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import type { FamilyParentsView } from "@/lib/family/service";
import type { FamilyInvite } from "@/lib/invites/family-invites";
import { StorytellerAvatar } from "./StorytellerAvatar";

type SavedInvite = Omit<FamilyInvite, "createdAt"> & { createdAt: string | Date };

/** Why an invitation wasn't emailed; mirrors EMAIL_MESSAGES on the server. */
const NOT_EMAILED: Record<string, string> = {
  suppressed: "asked not to get Readli invitations, so we didn't email them.",
  daily_limit: "wasn't emailed because you've reached today's email limit.",
  failed: "wasn't emailed because something went wrong on our side.",
};

const field = "min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink";
const card = "flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10";

/**
 * Settings → Parents. Everyone who parents this family, and (for the parent who manages the plan) a way
 * to invite a co-parent. A co-parent signs in as themselves and gets every parent's controls except
 * billing. The owner can remove a co-parent, and a co-parent can leave.
 */
export function FamilyParents({ view, initialInvites, live }: { view: FamilyParentsView; initialInvites: SavedInvite[]; live: boolean }) {
  const router = useRouter();
  const id = useId();
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ name: string; link: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const emailOk = email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = live && busy === null && emailOk && (email.trim() !== "" || name.trim() !== "");

  async function call(key: string, url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "That didn't work. Please try again.");
      return body ?? {};
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    const body = await call("invite", "/api/invites", { method: "POST", body: JSON.stringify({ email, name, role: "guardian" }) });
    if (!body) return;
    const saved = body.invite as SavedInvite;
    setInvites((list) => [saved, ...list]);
    setSent({ name: saved.name, link: body.link as string, email: typeof body.email === "string" ? body.email : "off" });
    setCopied(false);
    setEmail("");
    setName("");
  }

  async function withdraw(inviteId: string) {
    if (await call(inviteId, `/api/invites/${inviteId}`, { method: "DELETE" })) setInvites((list) => list.filter((i) => i.id !== inviteId));
  }

  async function remove(adultId: string, self: boolean) {
    if (!(await call(adultId, `/api/family/parents/${adultId}`, { method: "DELETE" }))) return;
    setConfirming(null);
    if (self) router.push("/");
    else router.refresh();
  }

  async function share(link: string, who: string) {
    const text = `Join our family on Readli as a parent, so you can set up stories for the kids from your own phone: ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: `Join ${view.familyName} on Readli, ${who}`, text });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      }
    } catch {
      /* Share sheet dismissed. */
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="family-parents">
      <section className="flex flex-col gap-3" aria-labelledby={`${id}-list`}>
        <h2 id={`${id}-list`} className="font-display text-2xl font-semibold">
          Parents in {view.familyName}
        </h2>
        <ul className="divide-y-2 divide-ink/5 rounded-3xl bg-surface ring-2 ring-ink/10">
          {view.parents.map((p) => {
            const canRemove = !p.owner && (view.youOwn || p.you);
            return (
              <li key={p.adultId} className="flex flex-col gap-3 px-4 py-3" data-testid="parent-row">
                <div className="flex items-center gap-3">
                  <StorytellerAvatar name={p.name} avatarUrl={p.avatarUrl} tint={p.tint} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-display text-lg font-semibold">
                      {p.name}
                      {p.you ? " (you)" : ""}
                    </span>
                    <span className="text-sm text-muted">{p.owner ? "Manages the plan and billing" : "Co-parent"}</span>
                  </span>
                  {canRemove && confirming !== p.adultId && (
                    <button type="button" className="min-h-11 px-2 font-semibold underline underline-offset-4" onClick={() => setConfirming(p.adultId)}>
                      {p.you ? "Leave family" : "Remove"}
                    </button>
                  )}
                </div>
                {confirming === p.adultId && (
                  <div className="flex flex-col gap-2 rounded-2xl bg-coral/15 p-3" role="group" aria-label={p.you ? "Leave this family" : `Remove ${p.name}`}>
                    <p>
                      {p.you
                        ? `You'll stop being a parent in ${view.familyName}. The children keep every storyteller you approved.`
                        : `${p.name} will stop being a parent in ${view.familyName}. The children keep every storyteller ${p.name} approved, and ${p.name}'s own voice leaves your storyteller slots.`}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" className={buttonPrimary} disabled={busy !== null} onClick={() => remove(p.adultId, p.you)}>
                        {busy === p.adultId ? "Working…" : p.you ? "Leave family" : `Remove ${p.name}`}
                      </button>
                      <button type="button" className={buttonSecondary} onClick={() => setConfirming(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={card} aria-labelledby={`${id}-what`}>
        <h2 id={`${id}-what`} className="font-display text-xl font-semibold">
          What a co-parent can do
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Sign in with their own email and see the whole family account.</li>
          <li>Choose which storytellers each child hears, and prepare new books.</li>
          <li>Open Readli Kids on their own phone or tablet when the kids use it.</li>
          <li>Record their own voice for the kids, if they want to. It&apos;s optional.</li>
        </ul>
        <p className="text-sm text-muted">{view.youOwn ? "You" : view.ownerName} keep{view.youOwn ? "" : "s"} the plan and billing. A co-parent can see the plan and credits but can&apos;t buy, change or cancel anything.</p>
      </section>

      {view.youOwn ? (
        <section className="flex flex-col gap-3" aria-labelledby={`${id}-invite`}>
          <h2 id={`${id}-invite`} className="font-display text-2xl font-semibold">
            Invite a co-parent
          </h2>
          {invites.length > 0 && (
            <ul className="flex flex-col gap-2" data-testid="co-parent-invites">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-sunshine/40 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{i.name}</span>
                    <span className="text-sm">Invitation sent. Waiting for them to join.</span>
                  </span>
                  <button type="button" className="min-h-11 px-2 font-semibold underline underline-offset-4" disabled={busy !== null} onClick={() => withdraw(i.id)}>
                    {busy === i.id ? "Withdrawing…" : "Withdraw"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {sent ? (
            <section aria-live="polite" className="flex flex-col items-start gap-3 rounded-3xl bg-mint/50 p-5" data-testid="co-parent-sent">
              <h3 className="font-display text-xl font-semibold">Invitation ready for {sent.name}</h3>
              {sent.email === "sent" ? (
                <p>We emailed {sent.name} the invitation. You can also send them this private link yourself. It works once and expires in 14 days.</p>
              ) : sent.email in NOT_EMAILED ? (
                <p>
                  {sent.name} {NOT_EMAILED[sent.email]} Send them this private link by text or email. It works once and expires in 14 days.
                </p>
              ) : (
                <p>Send {sent.name} this private link by text or email. It works once and expires in 14 days.</p>
              )}
              <p className="w-full break-all rounded-2xl bg-surface p-3 font-mono text-sm" data-testid="co-parent-link">
                {sent.link}
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={buttonPrimary} onClick={() => share(sent.link, sent.name)}>
                  {copied ? "Link copied" : "Share the link"}
                </button>
                <button type="button" className={buttonSecondary} onClick={() => setSent(null)}>
                  Done
                </button>
              </div>
            </section>
          ) : (
            <form onSubmit={invite} className={`${card} gap-5`} aria-label="Invite a co-parent" data-testid="co-parent-form">
              <p className="text-muted">They join as a second parent with their own sign-in. It&apos;s free for them, and nothing about billing changes.</p>
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
                <input id={`${id}-name`} className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
              </div>
              {error && (
                <p role="alert" className="rounded-2xl bg-coral/30 p-3 font-semibold">
                  {error}
                </p>
              )}
              <button type="submit" className={`${buttonPrimary} self-start`} disabled={!canSend}>
                {busy === "invite" ? "Creating invitation…" : "Invite co-parent"}
              </button>
              {!live && <p className="text-sm text-muted">This is a preview, so invitations can&apos;t be sent here.</p>}
            </form>
          )}
        </section>
      ) : (
        <>
          <p className="text-muted">Only {view.ownerName} can invite another parent.</p>
          {error && (
            <p role="alert" className="rounded-2xl bg-coral/30 p-3 font-semibold">
              {error}
            </p>
          )}
        </>
      )}
      {view.youOwn && error && sent && (
        <p role="alert" className="rounded-2xl bg-coral/30 p-3 font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}

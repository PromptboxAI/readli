"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { INVITE_TTL_DAYS } from "@/lib/invites/family-invites";
import { formatPrice } from "@/lib/family/plan";
import type { JoinedCard, NarratorCard, NarratorSlotsView } from "@/lib/family/service";
import { InvitationPill } from "@/components/invitations/InvitationPill";
import { InviteStoryteller, type SavedInvite } from "./InviteStoryteller";
import { StorytellerAvatar } from "./StorytellerAvatar";

/** "live": invitations are saved; "preview": the sample family, nothing saved; "off": no invitations here. */
export type InviteMode = "live" | "preview" | "off";

const pill = "shrink-0 rounded-full px-3 py-1 text-sm font-bold";
const day = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const WAITING: Record<NonNullable<NarratorCard["status"]>, { badge: string; tone: string; note: (name: string) => string }> = {
  processing: { badge: "Making their voice", tone: "bg-sky/60", note: (n) => `${n} recorded and their voice is being made.` },
  not_shared: { badge: "Not shared yet", tone: "bg-sunshine", note: (n) => `${n}'s voice is ready. Only ${n} can share it with your family.` },
  stopped_sharing: { badge: "Stopped sharing", tone: "bg-ink/10", note: (n) => `${n} stopped sharing their voice with your family.` },
};

function NicknameEditor({ name, ownName, busy, onSave }: { name: string; ownName: string; busy: boolean; onSave: (nickname: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(name === ownName ? "" : name);
  if (!open) {
    return (
      <button type="button" className="font-display font-semibold underline underline-offset-4" onClick={() => setOpen(true)}>
        Change what we call them
      </button>
    );
  }
  return (
    <form
      className="flex w-full flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(value.trim());
        setOpen(false);
      }}
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">
        What your family calls {ownName}
        <input
          className="rounded-2xl border-2 border-ink/20 bg-surface px-3 py-2 text-base font-normal"
          value={value}
          maxLength={40}
          placeholder={ownName}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button type="submit" className={buttonSecondary} disabled={busy}>
        Save
      </button>
      <button type="button" className="font-display font-semibold underline underline-offset-4" onClick={() => setOpen(false)}>
        Cancel
      </button>
      <p className="w-full text-sm text-muted">Only your family sees this. It doesn&apos;t change {ownName}&apos;s account or voice.</p>
    </form>
  );
}

/** Readli Family → Family storytellers: narrator slots, invitations and voices on the way. */
export function NarratorSlots({
  initial,
  canBuy = true,
  approveHref = "/family/kids",
  inviteMode = "off",
  invites: initialInvites = [],
  kids = [],
  focus = null,
}: {
  initial: NarratorSlotsView;
  canBuy?: boolean;
  approveHref?: string;
  inviteMode?: InviteMode;
  invites?: SavedInvite[];
  /** This parent's children, so a new narrator can be approved for them right here. */
  kids?: { id: string; name: string }[];
  /** A voice to open on, from the "ready to read" notice or email. */
  focus?: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [invites, setInvites] = useState(initialInvites);
  const [inviting, setInviting] = useState<{ name: string } | null>(null);
  const inviteRef = useRef<HTMLDivElement>(null);
  const free = view.total - view.active.length;
  const price = formatPrice(view.extraSlotPriceCents);
  const canInvite = inviteMode !== "off";
  const [picking, setPicking] = useState<{ voiceId: string; name: string } | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const pickRef = useRef<HTMLElement>(null);

  // "Add Mommy to My Family" lands here on that storyteller's card.
  useEffect(() => {
    if (focus) document.querySelector(`[data-testid="slot-${CSS.escape(focus)}"]`)?.scrollIntoView({ block: "center" });
  }, [focus]);
  useEffect(() => {
    if (picking) pickRef.current?.scrollIntoView({ block: "start" });
  }, [picking]);

  const pick = (voiceId: string, name: string) => {
    setChosen([]);
    setPicking({ voiceId, name });
  };

  // Approves the new narrator for the children ticked here: one parent decision per child, never automatic.
  const approveChosen = async () => {
    if (!picking || chosen.length === 0) return;
    setBusy(true);
    setMessage(null);
    for (const childId of chosen) {
      const res = await fetch(`/api/family/kids/${encodeURIComponent(childId)}/storytellers`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ changes: [{ voiceId: picking.voiceId, approved: true }] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setBusy(false);
        return setMessage(body?.error?.message ?? "We couldn't save that. Please try again.");
      }
    }
    const names = kids.filter((k) => chosen.includes(k.id)).map((k) => k.name);
    setBusy(false);
    setMessage(`${names.join(" and ")} can now hear ${picking.name}. Prepare a book in ${picking.name}'s voice from the library.`);
    setPicking(null);
    router.refresh();
  };

  // Home's "Invite a storyteller" links here with #invite.
  useEffect(() => {
    if (canInvite && window.location.hash === "#invite") setInviting({ name: "" });
  }, [canInvite]);
  useEffect(() => {
    if (inviting) inviteRef.current?.scrollIntoView({ block: "start" });
  }, [inviting]);

  const call = async (url: string, body: unknown, done: string) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMessage(json?.error?.message ?? "We couldn't save that. Please try again.");
      return false;
    }
    setView(json as NarratorSlotsView);
    setMessage(done);
    // Drops the app's cached copies of other family pages, so Back shows this change.
    router.refresh();
    return true;
  };

  const withdraw = async (inv: SavedInvite) => {
    setMessage(null);
    if (inviteMode === "live") {
      const res = await fetch(`/api/invites/${encodeURIComponent(inv.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return setMessage(body?.error?.message ?? "That invitation can't be withdrawn.");
      }
    }
    setInvites((list) => list.filter((i) => i.id !== inv.id));
    setMessage(`The invitation to ${inv.name} was withdrawn. Its link no longer works.`);
  };

  const resend = async (inv: SavedInvite) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/invites/${encodeURIComponent(inv.id)}/resend`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setMessage(body?.error?.message ?? "We couldn't send that just now. Please try again.");
    setInvites((list) => list.map((i) => (i.id === inv.id ? { ...i, status: "invited" as const, emailed: true } : i)));
    setMessage(
      body?.email === "sent"
        ? `We emailed ${inv.name} again with a fresh link. The old link no longer works.`
        : `${body?.message ?? "We couldn't send the email."} Here's the fresh link to share yourself: ${body?.link ?? ""}`,
    );
  };

  const person = (p: { name: string; ownName?: string; relationship: string; avatarUrl: string | null; tint: string }, muted = false) => (
    <>
      <StorytellerAvatar name={p.name} avatarUrl={p.avatarUrl} tint={p.tint} muted={muted} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl font-semibold">{p.name}</p>
        {(p.ownName || p.relationship) && <p className="text-sm text-muted">{[p.ownName, p.relationship].filter(Boolean).join(" · ")}</p>}
      </div>
    </>
  );

  // What your family calls a storyteller ("Mommy"). Only the name shown here changes.
  const rename = (n: NarratorCard) => (
    <NicknameEditor
      key={`${n.adultId}-${n.name}`}
      name={n.name}
      ownName={n.ownName ?? n.name}
      busy={busy}
      onSave={(nickname) =>
        call(
          "/api/family/narrators",
          { adultId: n.adultId, action: "nickname", nickname },
          nickname ? `Your family will see ${n.ownName ?? n.name} as ${nickname}.` : `Your family will see ${n.ownName ?? n.name}'s own name again.`,
        )
      }
    />
  );

  if (!view.hasPlan) {
    return <p className="rounded-3xl bg-sunshine/60 p-4 font-semibold">Narrator slots come with Readli Family.</p>;
  }

  const pendingInvites = invites.filter((i) => i.status === "invited" || i.status === "expired" || i.status === "declined");
  const onTheWay = view.shared.length + view.waiting.length + view.joined.length + pendingInvites.length;
  // Someone invited, joined or recording holds a free slot, so it isn't offered for another invitation.
  // The slot is only used once their voice is shared and the parent adds it; a ready voice shows in the
  // open slot's text instead.
  const holders = [
    ...view.waiting.filter((n) => !n.yours && n.status === "processing").map((n) => ({ key: n.voiceId, name: n.name, note: "Their voice is being made" })),
    ...view.joined.filter((p) => !p.yours).map((p) => ({ key: p.adultId, name: p.name, note: "Joined, hasn't recorded yet" })),
    ...pendingInvites.filter((i) => i.status === "invited").map((i) => ({ key: i.id, name: i.name, note: "Invited" })),
  ];
  const reserved = holders.slice(0, Math.max(free, 0));
  const open = Math.max(free - reserved.length, 0);
  const remove = (p: { adultId: string; name: string }) => {
    if (!window.confirm(`Remove ${p.name} from your family? Their voice stays theirs, but your children won't hear it. You can invite them again later.`)) return;
    void call("/api/family/narrators", { adultId: p.adultId, action: "remove" }, `${p.name} was removed from your family.`);
  };
  const removeButton = (p: { adultId: string; name: string }) => (
    <button type="button" className="font-display font-semibold underline underline-offset-4" disabled={busy} onClick={() => remove(p)}>
      Remove from family
    </button>
  );
  const openInvite = (name = "") => setInviting({ name });

  return (
    <div className="flex flex-col gap-8" data-testid="narrator-slots">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-semibold">Family storytellers</h1>
        <p className="max-w-2xl text-lg">
          Your plan includes {view.included} narrator slots{view.extra > 0 ? `, plus ${view.extra} you added` : ""}. Put a storyteller who has
          shared their voice into a slot, then choose which children can hear them. An invitation holds a slot for that person; withdraw it or remove them to
          free it.
        </p>
        <div className="flex flex-wrap gap-2" aria-hidden="true">
          {Array.from({ length: view.total }, (_, i) => (
            <span key={i} className={`h-4 w-12 rounded-full border-2 border-ink ${i < view.active.length ? "bg-coral" : "bg-surface"}`} />
          ))}
        </div>
        <p className="font-display text-xl font-semibold" data-testid="slots-used">
          {view.active.length} of {view.total} slots used
        </p>
      </div>

      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>
      {picking && kids.length > 0 ? (
        <section ref={pickRef} className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10" data-testid="pick-kids" aria-labelledby="pick-kids-h">
          <h2 id="pick-kids-h" className="font-display text-2xl font-semibold">
            Which children can hear {picking.name}?
          </h2>
          <ul className="flex flex-col gap-2">
            {kids.map((k) => (
              <li key={k.id}>
                <label className="flex min-h-11 items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    className="size-6 accent-coral-deep"
                    checked={chosen.includes(k.id)}
                    onChange={(e) => setChosen((c) => (e.target.checked ? [...c, k.id] : c.filter((x) => x !== k.id)))}
                  />
                  {k.name}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonPrimary} disabled={busy || chosen.length === 0} onClick={approveChosen}>
              Approve for {chosen.length === 1 ? "this child" : "these children"}
            </button>
            <button type="button" className={buttonSecondary} onClick={() => setPicking(null)}>
              Not now
            </button>
          </div>
        </section>
      ) : (
        message?.includes("Now choose which children") && (
          <Link href={approveHref} className={`${buttonPrimary} self-start`}>
            Approve for your kids
          </Link>
        )
      )}

      <section className="flex flex-col gap-3" aria-label="Narrator slots">
        <h2 className="font-display text-2xl font-semibold">Narrator slots</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {view.active.map((n, i) => (
            <li key={n.voiceId} data-testid={`slot-${n.voiceId}`} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold tracking-wider text-muted uppercase">
                  Slot {i + 1} · {i < view.included ? "included" : "added"}
                </span>
                <span className={`${pill} bg-mint`}>In use</span>
              </div>
              <div className="flex items-center gap-4">{person(n)}</div>
              <div className="flex flex-wrap gap-2">
                <Link href={approveHref} className={buttonSecondary}>
                  Choose kids
                </Link>
                {rename(n)}
                <button
                  type="button"
                  className={buttonSecondary}
                  disabled={busy || view.releasesLeft === 0}
                  onClick={() => call("/api/family/narrators", { voiceId: n.voiceId, action: "release" }, `${n.name}'s slot is free. Their approvals for each child were removed.`)}
                >
                  Free up this slot
                </button>
              </div>
            </li>
          ))}
          {reserved.map((r, i) => (
            <li key={`held-${r.key}`} data-testid="reserved-slot" className="flex flex-col gap-3 rounded-3xl border-[3px] border-dashed border-ink/30 bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold tracking-wider text-muted uppercase">
                  Slot {view.active.length + i + 1} · {view.active.length + i < view.included ? "included" : "added"}
                </span>
                <span className={`${pill} bg-lavender/60`}>Reserved</span>
              </div>
              <p className="font-display text-xl font-semibold">Held for {r.name}</p>
              <p className="text-sm text-muted">{r.note}. See Storytellers on the way below.</p>
            </li>
          ))}
          {Array.from({ length: open }, (_, i) => (
            <li key={`free-${i}`} data-testid="free-slot" className="flex flex-col gap-3 rounded-3xl border-[3px] border-dashed border-coral/60 bg-ivory p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold tracking-wider text-muted uppercase">
                  Slot {view.active.length + reserved.length + i + 1} · {view.active.length + reserved.length + i < view.included ? "included" : "added"}
                </span>
                <span className={`${pill} bg-sunshine`}>Available</span>
              </div>
              <p className="font-display text-xl font-semibold">Who else should read to your kids?</p>
              <p>
                {view.shared.length > 0
                  ? `${view.shared[0]!.name} is ready to add below. Or invite someone new: they record for free and share their voice with your family.`
                  : "Invite a partner, grandparent or friend. They record for free and share their voice with your family, then you add them here."}
              </p>
              {canInvite && i === 0 && (
                <button type="button" className={`${buttonPrimary} self-start`} onClick={() => openInvite()}>
                  Invite a storyteller
                </button>
              )}
            </li>
          ))}
        </ul>
        {view.releasesLeft <= 1 && (
          <p className="text-sm text-muted">
            {view.releasesLeft === 0 ? "You've changed narrators a lot this month, so slots can't be freed right now." : "You can free one more slot this month."}
          </p>
        )}
      </section>

      {canInvite && (
        <div id="invite" ref={inviteRef} className="scroll-mt-24">
          {inviting && (
            <InviteStoryteller
              key={inviting.name}
              live={inviteMode === "live"}
              initialName={inviting.name}
              onSent={(inv) => setInvites((list) => [inv, ...list.filter((i) => !(i.status === "expired" && i.name === inv.name))])}
              onClose={() => setInviting(null)}
            />
          )}
        </div>
      )}

      <section className="flex flex-col gap-3" aria-label="Storytellers on the way">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold">Storytellers on the way</h2>
          {canInvite && open <= 0 && !inviting && (
            <button type="button" className="font-display font-semibold underline underline-offset-4" onClick={() => openInvite()}>
              Invite a storyteller
            </button>
          )}
        </div>
        {onTheWay === 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10" data-testid="on-the-way-empty">
            <p className="min-w-0 flex-1">
              <span className="font-semibold">No one is on the way yet.</span> When you invite someone, you&apos;ll see each step here: invitation sent, joined,
              recording, and ready to add.
            </p>
            {canInvite && !inviting && (
              <button type="button" className={buttonSecondary} onClick={() => openInvite()}>
                Invite someone
              </button>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="on-the-way">
            {view.shared.map((n) => (
              <li
                key={n.voiceId}
                data-testid={`slot-${n.voiceId}`}
                className={`flex flex-wrap items-center gap-4 rounded-3xl bg-mint/30 p-4 ${focus === n.voiceId ? "ring-4 ring-coral-deep" : "ring-2 ring-ink/10"}`}
              >
                {person(n)}
                <span className={`${pill} bg-mint`}>Ready to add</span>
                <button
                  type="button"
                  className={buttonPrimary}
                  disabled={busy || free <= 0}
                  onClick={async () => {
                    if (await call("/api/family/narrators", { voiceId: n.voiceId, action: "activate" }, `${n.name} is in a narrator slot. Now choose which children can hear them.`)) pick(n.voiceId, n.name);
                  }}
                >
                  Add to a slot
                </button>
                {rename(n)}
                {removeButton(n)}
                {free <= 0 && (
                  <p className="w-full text-sm" data-testid="slots-full-note">
                    {n.name}&apos;s voice is ready, but all your narrator slots are in use. Free one up, or add a slot below.
                  </p>
                )}
              </li>
            ))}
            {view.waiting.map((n) => {
              const w = WAITING[n.status ?? "not_shared"];
              return (
                <li key={n.voiceId} data-testid={`slot-${n.voiceId}`} className="flex flex-wrap items-center gap-4 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
                  {person(n, !n.yours)}
                  {n.yours && n.status !== "processing" ? (
                    <Link href="/family/my-voice" className={buttonPrimary}>
                      Share my voice
                    </Link>
                  ) : (
                    <span className={`${pill} ${w.tone}`} title={w.note(n.name)}>
                      {w.badge}
                    </span>
                  )}
                  {!n.yours && removeButton(n)}
                  {!n.yours && <p className="w-full text-sm text-muted">{w.note(n.name)}</p>}
                </li>
              );
            })}
            {view.joined.map((p: JoinedCard) => (
              <li key={p.adultId} data-testid={`joined-${p.adultId}`} className="flex flex-wrap items-center gap-4 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
                {person(p, !p.yours)}
                {p.yours ? (
                  <Link href="/voice/record" className={buttonPrimary}>
                    Record my voice
                  </Link>
                ) : (
                  <>
                    <span className={`${pill} bg-sky/60`}>Joined</span>
                    {removeButton(p)}
                  </>
                )}
                {!p.yours && <p className="w-full text-sm text-muted">{p.name} joined your family and hasn&apos;t recorded their voice yet.</p>}
              </li>
            ))}
            {pendingInvites.map((inv) => {
              const expired = inv.status === "expired";
              const declined = inv.status === "declined";
              const until = inv.expiresAt ? new Date(inv.expiresAt) : new Date(new Date(inv.createdAt).getTime() + INVITE_TTL_DAYS * 86_400_000);
              return (
                <li key={inv.id} data-testid={`invite-${inv.id}`} className="flex flex-wrap items-center gap-4 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
                  <StorytellerAvatar name={inv.name} avatarUrl={null} tint="bg-ivory" muted />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl font-semibold">{inv.name}</p>
                    <p className="text-sm text-muted">
                      {declined
                        ? "They said no thanks. We won't email them again for your family."
                        : expired
                          ? "The link expired before it was used."
                          : `${inv.emailed ? "Emailed" : "Created"} ${day(inv.createdAt)}. The link works until ${day(until)}.`}
                    </p>
                  </div>
                  <InvitationPill state={declined ? "declined" : expired ? "expired" : "sent"} />
                  {declined ? null : inv.canResend && inviteMode === "live" ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" className={buttonSecondary} disabled={busy} onClick={() => resend(inv)}>
                        {expired ? "Send a fresh link" : "Resend email"}
                      </button>
                      {!expired && (
                        <button type="button" className="font-display font-semibold underline underline-offset-4" onClick={() => withdraw(inv)}>
                          Withdraw
                        </button>
                      )}
                    </div>
                  ) : expired ? (
                    <button type="button" className={buttonSecondary} onClick={() => openInvite(inv.name)}>
                      Invite again
                    </button>
                  ) : (
                    <button type="button" className="font-display font-semibold underline underline-offset-4" onClick={() => withdraw(inv)}>
                      Withdraw
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {free <= 0 && view.shared.length > 0 && <p className="font-semibold">All your slots are in use. Free one up or add a slot.</p>}
      </section>

      {free <= 0 && (
        <section className="flex flex-col gap-3 rounded-panel bg-sky/30 p-5" aria-label="Add a narrator slot">
          <h2 className="font-display text-2xl font-semibold">Need more narrators?</h2>
          <p>
            Add a narrator slot for {price} a month. Storytellers never pay to share their voice, and there&apos;s no charge for more children.
          </p>
          {!canBuy ? (
            <p className="text-sm text-muted">Extra slots arrive with checkout, which isn&apos;t switched on yet.</p>
          ) : !buying ? (
            <button type="button" className={`${buttonSecondary} self-start`} onClick={() => setBuying(true)}>
              Add a slot
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10" data-testid="slot-checkout">
              <p className="font-display text-xl font-semibold">1 extra narrator slot · {price}/month</p>
              <p className="text-sm text-muted">
                {view.extraSlotPriceApproved ? "" : "Price pending approval. "}Payments aren&apos;t switched on yet, so this preview adds the slot without
                charging you.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonPrimary}
                  disabled={busy}
                  onClick={async () => {
                    await call("/api/family/narrators/slots", null, "Slot added. You can put another storyteller in it now.");
                    setBuying(false);
                  }}
                >
                  Confirm slot
                </button>
                <button type="button" className={buttonSecondary} onClick={() => setBuying(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

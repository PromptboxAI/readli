"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { dollars, shortDate, SPONSORED } from "@/lib/sponsorship/rules";
import type { GiftView, PlaceView, PlaceState } from "@/lib/sponsorship/view";

const DAY = 86_400_000;
const lastDay = (iso: string) => shortDate(new Date(Date.parse(iso) - DAY));
const day = (iso: string) => shortDate(new Date(iso));

const STATE: Record<PlaceState, { label: string; tone: string }> = {
  arrives: { label: "Arrives soon", tone: "bg-sky/50" },
  invited: { label: "Invited", tone: "bg-lavender/60" },
  opened: { label: "Invitation opened", tone: "bg-sunshine/60" },
  joined: { label: "Joined", tone: "bg-mint/60" },
  removal_scheduled: { label: "Removal scheduled", tone: "bg-coral/30" },
  ended: { label: "Ended", tone: "bg-ink/10" },
};

async function post(path: string, body: unknown): Promise<{ ok: boolean; json: Record<string, unknown> & { error?: { message?: string } } }> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return { ok: Boolean(res?.ok), json: ((await res?.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
}

function summary(g: GiftView): string {
  const what = g.plan === "annual" ? `a whole year, ${dollars(g.priceCents)} paid ${day(g.paidAt)}` : `monthly, ${dollars(g.priceCents)} a month`;
  const covers = g.status === "scheduled" ? `arrives ${day(g.deliverAt)}` : g.startsAt && g.paidThrough ? `covers ${day(g.startsAt)} to ${lastDay(g.endsAt ?? g.paidThrough)}` : "";
  const renew = g.plan === "annual" ? "no automatic renewal" : g.nextChargeAt ? `next charge ${day(g.nextChargeAt)}` : g.endsAt ? `ends ${lastDay(g.endsAt)}` : "";
  return ["Readli Family for your families", what, covers, renew].filter(Boolean).join(" · ");
}

/** The sponsor's gift page: two private family cards, the credit split, and confirmed changes. */
export function SponsorDashboard({ gift }: { gift: GiftView }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<PlaceView | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");
  const live = gift.places.filter((p) => p.state !== "ended");
  const ended = gift.status === "ended" || gift.status === "refunded";

  async function act(path: string, body: unknown) {
    setError("");
    const { ok, json } = await post(path, body);
    if (!ok) setError(json.error?.message ?? "Something went wrong. Please try again.");
    router.refresh();
    return ok;
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby={`gift-${gift.id}`} data-testid="sponsor-gift">
      <header className="flex flex-col gap-1">
        <h2 id={`gift-${gift.id}`} className="font-display text-3xl font-semibold">
          Your gift to the family
        </h2>
        <p>{summary(gift)}</p>
        {gift.status === "past_due" && (
          <p role="status" className="rounded-2xl bg-sunshine/50 px-4 py-3">
            This month&apos;s payment didn&apos;t go through. Your families can still listen while we try again. Please update your card.
          </p>
        )}
        {gift.status === "refunded" && <p className="rounded-2xl bg-ink/5 px-4 py-3">This gift was canceled and refunded in full.</p>}
      </header>

      {error && (
        <p role="alert" className="rounded-2xl bg-coral/20 px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((seat) => {
          const p = gift.places.find((x) => x.seat === seat && x.state !== "ended") ?? gift.places.find((x) => x.seat === seat);
          return p && p.state !== "ended" ? (
            <FamilyCard key={seat} place={p} gift={gift} onRemove={() => setRemoving(p)} onUndo={() => act(`/api/sponsorships/${gift.id}/places/${seat}`, { action: "undo" })} />
          ) : (
            <FreePlace key={seat} seat={seat} gift={gift} previous={p ?? null} onOffer={(body) => act(`/api/sponsorships/${gift.id}/places/${seat}`, { action: "offer", ...body })} />
          );
        })}
      </div>

      {!ended && live.length > 0 && <CreditSplit gift={gift} places={live} onSave={(shares) => act(`/api/sponsorships/${gift.id}/credits`, { shares })} />}

      <section className="rounded-3xl bg-ivory p-5 text-sm" aria-label="What you can see">
        <p className="font-semibold">What you can see</p>
        <p>
          Whether each family has joined, whether its parents have approved your voice, and how many credits it used. Their children, books, listening and other storytellers stay private to each
          family.
        </p>
      </section>

      {gift.plan === "annual" && gift.status === "active" && gift.paidThrough && (
        <p className="text-sm">Your year ends {lastDay(gift.paidThrough)}. We&apos;ll ask you 30 days before whether to give another year. Nothing renews without you.</p>
      )}

      {!ended && gift.status !== "canceling" && (
        <button type="button" className={`${buttonQuiet} self-start px-0`} onClick={() => setCanceling(true)}>
          Cancel the gift and see refund rules
        </button>
      )}

      {removing && (
        <RemoveDialog
          place={removing}
          gift={gift}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            if (await act(`/api/sponsorships/${gift.id}/places/${removing.seat}`, { action: "remove", confirmed: true })) setRemoving(null);
          }}
        />
      )}
      {canceling && (
        <CancelDialog
          gift={gift}
          onClose={() => setCanceling(false)}
          onConfirm={async () => {
            if (await act(`/api/sponsorships/${gift.id}/cancel`, {})) setCanceling(false);
          }}
        />
      )}
    </section>
  );
}

function FamilyCard({ place, gift, onRemove, onUndo }: { place: PlaceView; gift: GiftView; onRemove: () => void; onUndo: () => void }) {
  const s = STATE[place.state];
  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10" data-testid={`place-${place.seat}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-2xl font-semibold">{place.name}</h3>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${s.tone}`}>{s.label}</span>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{place.state === "joined" || place.state === "removal_scheduled" ? "Joined" : "Invitation"}</dt>
        <dd>
          {place.joinedAt
            ? day(place.joinedAt)
            : place.state === "arrives"
              ? `Arrives ${day(gift.deliverAt)}`
              : place.openedAt
                ? `Opened ${day(place.openedAt)}, not joined yet`
                : "Sent, not opened yet"}
        </dd>
        <dt className="text-muted">Your voice</dt>
        <dd>{place.voice === "approved" ? "Approved by the parents" : place.voice === "waiting" ? "Shared, waiting for the parents" : "Not shared"}</dd>
        <dt className="text-muted">Story credits this month</dt>
        <dd>
          {place.usedThisMonth.toLocaleString("en-US")} of {place.creditShare} used
        </dd>
      </dl>
      {place.state === "removal_scheduled" && place.accessUntil ? (
        <p className="text-sm">
          Removal scheduled for {lastDay(place.accessUntil)}.{" "}
          <button type="button" className="font-semibold underline underline-offset-4" onClick={onUndo}>
            Undo
          </button>
        </p>
      ) : (
        gift.status !== "ended" &&
        gift.status !== "refunded" && (
          <button type="button" className="self-start text-sm font-semibold underline underline-offset-4" onClick={onRemove}>
            Remove this family
          </button>
        )
      )}
    </article>
  );
}

function FreePlace({ seat, gift, previous, onOffer }: { seat: number; gift: GiftView; previous: PlaceView | null; onOffer: (b: { name: string; email: string; shareVoice: boolean }) => Promise<boolean> }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [shareVoice, setShareVoice] = useState(true);
  const canOffer = Boolean(gift.startsAt) && ["active", "past_due"].includes(gift.status) && gift.freePlaces.includes(seat);
  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius-panel)] border-[3px] border-dashed border-ink/20 p-5" data-testid={`free-place-${seat}`}>
      <h3 className="font-display text-xl font-semibold">A free place</h3>
      {previous && <p className="text-sm text-muted">{previous.name} no longer has your gift.</p>}
      {!canOffer ? (
        <p className="text-sm">You can offer this place to another family once your gift has arrived.</p>
      ) : !gift.canChangeFamilies ? (
        <p className="text-sm">You&apos;ve changed families twice in the last 12 months, so this place can&apos;t go to another family yet.</p>
      ) : open ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onOffer({ name, email, shareVoice })) setOpen(false);
          }}
        >
          <label htmlFor={`${id}-n`} className="text-sm font-semibold">
            Family name
          </label>
          <input id={`${id}-n`} className="min-h-11 rounded-2xl border-2 border-ink/20 px-3" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          <label htmlFor={`${id}-e`} className="text-sm font-semibold">
            A parent&apos;s email
          </label>
          <input id={`${id}-e`} type="email" className="min-h-11 rounded-2xl border-2 border-ink/20 px-3" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={shareVoice} onChange={(e) => setShareVoice(e.target.checked)} /> Share my voice with this family
          </label>
          <button type="submit" className={buttonPrimary}>
            Send the invitation
          </button>
        </form>
      ) : (
        <button type="button" className={`${buttonSecondary} self-start`} onClick={() => setOpen(true)}>
          Offer it to a family
        </button>
      )}
    </article>
  );
}

function CreditSplit({ gift, places, onSave }: { gift: GiftView; places: PlaceView[]; onSave: (shares: Record<number, number>) => Promise<boolean> }) {
  const current = Object.fromEntries(places.map((p) => [p.seat, p.nextShare ?? p.creditShare])) as Record<number, number>;
  const [shares, setShares] = useState(current);
  const [saved, setSaved] = useState(false);
  const two = places.length === 2;
  const total = Object.values(shares).reduce((a, b) => a + b, 0);
  const changed = places.some((p) => shares[p.seat] !== current[p.seat]);
  const pending = places.find((p) => p.nextShare !== null && p.nextFrom);
  const move = (seat: number, delta: number) => {
    const next = { ...shares, [seat]: shares[seat]! + delta };
    if (two) {
      const other = places.find((p) => p.seat !== seat)!.seat;
      next[other] = SPONSORED.monthlyCredits - next[seat]!;
    }
    if (Object.values(next).some((v) => v < SPONSORED.minShare) || Object.values(next).reduce((a, b) => a + b, 0) > SPONSORED.monthlyCredits) return;
    setShares(next);
    setSaved(false);
  };
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10" aria-labelledby={`split-${gift.id}`}>
      <h3 id={`split-${gift.id}`} className="font-display text-xl font-semibold">
        40 story credits a month, shared
      </h3>
      <p className="text-sm">
        Each family has 20 to start. Move credits in steps of 5 for the next gift month; this month stays as it is.
      </p>
      {places.map((p) => (
        <div key={p.seat} className="flex items-center justify-between gap-3">
          <span className="font-semibold">{p.name}</span>
          <span className="flex items-center gap-2">
            <button type="button" aria-label={`5 fewer credits for ${p.name}`} className="grid size-11 place-items-center rounded-full border-[3px] border-ink font-display text-xl disabled:opacity-40" disabled={shares[p.seat]! - 5 < SPONSORED.minShare} onClick={() => move(p.seat, -5)}>
              −
            </button>
            <output aria-live="polite" aria-label={`Credits for ${p.name}`} className="w-24 text-center font-display text-lg">
              {shares[p.seat]} credits
            </output>
            <button
              type="button"
              aria-label={`5 more credits for ${p.name}`}
              className="grid size-11 place-items-center rounded-full border-[3px] border-ink font-display text-xl disabled:opacity-40"
              disabled={two ? SPONSORED.monthlyCredits - shares[p.seat]! - 5 < SPONSORED.minShare : total + 5 > SPONSORED.monthlyCredits}
              onClick={() => move(p.seat, 5)}
            >
              +
            </button>
          </span>
        </div>
      ))}
      {gift.nextMonthFrom && <p className="text-sm text-muted">Starts {day(gift.nextMonthFrom)}. We&apos;ll let the family know before it does. You see how many credits each family uses, never which stories.</p>}
      {pending && !changed && pending.nextFrom && <p className="text-sm">A new split starts {day(pending.nextFrom)}.</p>}
      {changed && (
        <button
          type="button"
          className={`${buttonPrimary} self-start`}
          onClick={async () => {
            if (await onSave(shares)) setSaved(true);
          }}
        >
          Save the new split
        </button>
      )}
      {saved && !changed && <p role="status">Saved.</p>}
    </section>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="presentation" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={id} className="flex w-full max-w-lg flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6" onClick={(e) => e.stopPropagation()}>
        <h2 id={id} className="font-display text-2xl font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** The approved removal confirmation: the exact last day, what they keep, and a tick before the button turns on. */
function RemoveDialog({ place, gift, onClose, onConfirm }: { place: PlaceView; gift: GiftView; onClose: () => void; onConfirm: () => void }) {
  const [sure, setSure] = useState(false);
  const joined = place.state === "joined";
  // The end of the current gift month, or the gift's own end if that's sooner.
  const until = gift.nextMonthFrom && gift.endsAt && gift.endsAt < gift.nextMonthFrom ? gift.endsAt : (gift.nextMonthFrom ?? new Date().toISOString());
  const last = lastDay(until);
  return (
    <Dialog title={`Remove ${place.name} from your gift?`} onClose={onClose}>
      {joined ? (
        <>
          <p className="font-semibold">Their last day with your gift: {last}</p>
          <p>Until then nothing changes for them. After that, listening pauses unless they choose their own plan.</p>
          <p>Their children&apos;s profiles, approvals and progress stay with them. Stories in your voice stay as long as you keep sharing your voice with them.</p>
          <p>
            You can offer this place to another family from {day(until)}. You can change families twice in any 12 months.
          </p>
        </>
      ) : (
        <p>They haven&apos;t joined yet, so their invitation stops working straight away and the place is free again.</p>
      )}
      <label className="flex items-start gap-2 rounded-2xl bg-ivory p-3">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={sure} onChange={(e) => setSure(e.target.checked)} />
        {joined ? `I understand ${place.name}'s family loses my gift after ${last}.` : `I understand ${place.name}'s invitation will stop working.`}
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonSecondary} onClick={onClose}>
          Keep this family
        </button>
        <button type="button" className={buttonPrimary} disabled={!sure} onClick={onConfirm}>
          {joined ? `Remove on ${last.replace(/, \d{4}$/, "")}` : "Withdraw the invitation"}
        </button>
      </div>
      {joined && <p className="text-sm text-muted">The button turns on once you tick the box. Until {last.replace(/, \d{4}$/, "")} you can undo this from your gift page.</p>}
    </Dialog>
  );
}

function CancelDialog({ gift, onClose, onConfirm }: { gift: GiftView; onClose: () => void; onConfirm: () => void }) {
  const [sure, setSure] = useState(false);
  const before = gift.status === "scheduled";
  const end = gift.paidThrough;
  if (gift.plan === "annual" && !before) {
    return (
      <Dialog title="Your year doesn't renew" onClose={onClose}>
        <p>There&apos;s nothing to cancel: your gift ends {end ? lastDay(end) : "at the end of the year"} and nothing will be charged again.</p>
        <p>If something&apos;s wrong and you&apos;d like a refund, please contact us and we&apos;ll help.</p>
        <button type="button" className={`${buttonSecondary} self-start`} onClick={onClose}>
          Close
        </button>
      </Dialog>
    );
  }
  return (
    <Dialog title="Cancel your gift?" onClose={onClose}>
      {before ? (
        <p>Your gift hasn&apos;t arrived yet, so you get a full refund of {dollars(gift.priceCents)} and no invitation goes out.</p>
      ) : (
        <>
          <p className="font-semibold">Both families keep Readli until {end ? lastDay(end) : "the end of this month"}.</p>
          <p>Nothing more will be charged. After that, listening pauses unless they choose their own plan. Their children&apos;s profiles, approvals and progress stay with them.</p>
        </>
      )}
      <label className="flex items-start gap-2 rounded-2xl bg-ivory p-3">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={sure} onChange={(e) => setSure(e.target.checked)} />I understand.
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonSecondary} onClick={onClose}>
          Keep the gift
        </button>
        <button type="button" className={buttonPrimary} disabled={!sure} onClick={onConfirm}>
          {before ? "Cancel and refund" : "Stop renewing"}
        </button>
      </div>
    </Dialog>
  );
}

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { EnvelopeArt, GiftBoxArt, StarSticker } from "@/components/invites/illustrations";
import { dollars, shortDate, SPONSORED } from "@/lib/sponsorship/rules";
import type { GiftView, PlaceView, PlaceState } from "@/lib/sponsorship/view";

const DAY = 86_400_000;
const lastDay = (iso: string) => shortDate(new Date(Date.parse(iso) - DAY));
const day = (iso: string) => shortDate(new Date(iso));

const STATE: Record<PlaceState, { label: string; tone: string }> = {
  arrives: { label: "On its way", tone: "bg-sky/50" },
  invited: { label: "Invitation sent", tone: "bg-lavender/60" },
  opened: { label: "Invitation opened", tone: "bg-sunshine/70" },
  joined: { label: "Listening", tone: "bg-mint/70" },
  removal_scheduled: { label: "Leaving soon", tone: "bg-coral/30" },
  ended: { label: "Ended", tone: "bg-ink/10" },
};

/** How far along each family is: on its way, sent, opened, joined. */
const STAGE: Record<PlaceState, number> = { arrives: 0, invited: 1, opened: 2, joined: 3, removal_scheduled: 3, ended: 0 };

/** Each place keeps its own colour, in the cards and in the credit bar. */
const SEAT_TONE: Record<number, { bar: string; soft: string; ring: string }> = {
  1: { bar: "bg-coral", soft: "bg-coral/15", ring: "ring-coral/40" },
  2: { bar: "bg-sky", soft: "bg-sky/20", ring: "ring-sky/50" },
};
const tone = (seat: number) => SEAT_TONE[seat] ?? SEAT_TONE[1]!;

async function post(path: string, body: unknown): Promise<{ ok: boolean; json: Record<string, unknown> & { error?: { message?: string } } }> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return { ok: Boolean(res?.ok), json: ((await res?.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
}

/** The receipt line, kept for the gift details at the bottom. */
function summary(g: GiftView): string {
  const what = g.plan === "annual" ? `A whole year, ${dollars(g.priceCents)} paid ${day(g.paidAt)}` : `Monthly, ${dollars(g.priceCents)} a month`;
  const covers = g.status === "scheduled" ? `arrives ${day(g.deliverAt)}` : g.startsAt && g.paidThrough ? `covers ${day(g.startsAt)} to ${lastDay(g.endsAt ?? g.paidThrough)}` : "";
  const renew = g.plan === "annual" ? "no automatic renewal" : g.nextChargeAt ? `next charge ${day(g.nextChargeAt)}` : g.endsAt ? `ends ${lastDay(g.endsAt)}` : "";
  return [what, covers, renew].filter(Boolean).join(" · ");
}

/** "Emma", "Emma and the Lees". */
function names(places: PlaceView[]): string {
  const n = places.map((p) => p.name);
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

function headline(g: GiftView, live: PlaceView[]): { title: string; line: string } {
  const who = names(live);
  if (g.status === "refunded") return { title: "Your Readli Family gift", line: "This gift was canceled and refunded in full." };
  if (g.status === "ended") return { title: "Your Readli Family gift", line: `Thank you for the stories you gave${who ? ` ${who}` : ""}.` };
  if (g.status === "scheduled") return { title: "Your gift is wrapped and on its way", line: `It arrives ${day(g.deliverAt)}. That morning${who ? ` ${who}` : " your families"} get${live.length === 1 ? "s" : ""} an invitation from you.` };
  const span = g.plan === "annual" ? "a whole year of bedtime stories" : "bedtime stories every month";
  return { title: g.plan === "annual" ? "You gave a year of bedtime stories" : "You gave bedtime stories, every month", line: who ? `${who} now ${live.length === 1 ? "has" : "have"} ${span}, from you.` : `Your gift holds ${span}. Invite a family to start them.` };
}

const COVERS = ["/covers/the-three-billy-goats-gruff.webp", "/covers/the-tale-of-peter-rabbit.webp", "/covers/the-velveteen-rabbit.webp"];

function Confetti({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 200" className={className} aria-hidden="true" preserveAspectRatio="none">
      <g opacity="0.9">
        <circle cx="10" cy="30" r="4" fill="#ffce58" />
        <circle cx="370" cy="30" r="6" fill="#7bc7f3" />
        <circle cx="330" cy="160" r="4" fill="#ff7967" />
        <rect x="300" y="14" width="12" height="5" rx="2.5" fill="#ff7967" transform="rotate(30 306 16)" />
        <rect x="280" y="70" width="12" height="5" rx="2.5" fill="#cbb7f5" transform="rotate(-25 286 72)" />
        <rect x="290" y="184" width="12" height="5" rx="2.5" fill="#ffce58" transform="rotate(15 296 186)" />
        <path d="M352 100 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1z" fill="#ffce58" />
      </g>
    </svg>
  );
}

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const MicIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5 shrink-0" {...ICON}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
const BookIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5 shrink-0" {...ICON}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
  </svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6 shrink-0" {...ICON}>
    <rect x="4" y="10" width="16" height="11" rx="3" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
const HouseIcon = () => (
  <svg viewBox="0 0 24 24" className="size-7" {...ICON}>
    <path d="M3 11l9-7 9 7M5 10v10h14V10" />
    <path d="M12 17c-2-1.6-3-2.6-3-3.8a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.2-1 2.2-3 3.8z" fill="currentColor" stroke="none" />
  </svg>
);

/** The giver's gift page: a celebration of what they gave first, then the two families, the story split, and the fine print. */
export function SponsorDashboard({ gift }: { gift: GiftView }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<PlaceView | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");
  const live = gift.places.filter((p) => p.state !== "ended");
  const ended = gift.status === "ended" || gift.status === "refunded";
  const { title, line } = headline(gift, live);
  const voiceShared = live.some((p) => p.voice !== "not_shared");

  async function act(path: string, body: unknown) {
    setError("");
    const { ok, json } = await post(path, body);
    if (!ok) setError(json.error?.message ?? "Something went wrong. Please try again.");
    router.refresh();
    return ok;
  }

  return (
    <section className="flex flex-col gap-10" aria-labelledby={`gift-${gift.id}`} data-testid="sponsor-gift">
      <header className="relative overflow-hidden rounded-[32px] bg-[radial-gradient(120%_120%_at_0%_0%,#ffe7a8_0%,#ffd9cf_45%,#fff4e4_100%)] px-5 py-8 shadow-[0_24px_50px_-28px_rgba(40,53,72,0.45)] sm:px-10 sm:py-12">
        <Confetti className="pointer-events-none absolute inset-0 hidden h-full w-full sm:block" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-extrabold tracking-[0.16em] text-coral-deep uppercase">{ended ? "Readli Family gift" : `A gift from ${gift.giverName || "you"}`}</p>
            <h2 id={`gift-${gift.id}`} className="font-display text-4xl leading-[1.08] font-semibold sm:text-5xl">
              {title}
            </h2>
            <p className="max-w-xl text-xl leading-relaxed text-ink/85">{line}</p>
            {gift.message && (
              <figure className="relative max-w-xl -rotate-1 rounded-2xl bg-surface px-5 py-4 shadow-[3px_4px_0_rgba(40,53,72,0.12)]">
                <blockquote className="font-display text-xl leading-snug">&ldquo;{gift.message}&rdquo;</blockquote>
                <figcaption className="mt-1 text-sm text-muted">Your note to the families</figcaption>
              </figure>
            )}
            {!ended && (
              <ul className="flex flex-wrap gap-2 pt-1 text-base font-semibold">
                <li className="rounded-full bg-surface/90 px-4 py-2 shadow-sm">{SPONSORED.monthlyCredits} story credits a month</li>
                <li className="rounded-full bg-surface/90 px-4 py-2 shadow-sm">
                  {live.length === 1 ? "1 family" : `${live.length || "Up to 2"} families`}
                </li>
                {gift.startsAt && gift.paidThrough ? (
                  <li className="rounded-full bg-surface/90 px-4 py-2 shadow-sm">
                    {gift.plan === "annual" ? `${day(gift.startsAt).replace(/, \d{4}$/, "")} to ${lastDay(gift.endsAt ?? gift.paidThrough)}` : `Since ${day(gift.startsAt)}`}
                  </li>
                ) : (
                  gift.status === "scheduled" && <li className="rounded-full bg-surface/90 px-4 py-2 shadow-sm">Arrives {day(gift.deliverAt)}</li>
                )}
                {voiceShared && <li className="rounded-full bg-surface/90 px-4 py-2 shadow-sm">Read in your voice</li>}
              </ul>
            )}
          </div>
          <div className="relative mx-auto hidden h-52 w-64 sm:block" aria-hidden="true">
            {COVERS.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt=""
                width={96}
                height={128}
                className="absolute top-2 h-auto w-24 rounded-l-[4px] rounded-r-[10px] shadow-[3px_4px_0_rgba(40,53,72,0.16)]"
                style={{ left: `${24 + i * 56}px`, transform: `rotate(${(i - 1) * 9}deg)`, zIndex: i === 1 ? 2 : 1 }}
              />
            ))}
            <GiftBoxArt open className="absolute right-0 -bottom-2 z-10 w-32 motion-safe:animate-bob" />
          </div>
        </div>
      </header>

      {gift.status === "past_due" && (
        <p role="status" className="rounded-2xl bg-sunshine/50 px-4 py-3">
          This month&apos;s payment didn&apos;t go through. Your families can still listen while we try again. Please update your card.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-2xl bg-coral/20 px-4 py-3">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-4" aria-labelledby={`families-${gift.id}`}>
        <div className="flex flex-col gap-1">
          <h3 id={`families-${gift.id}`} className="font-display text-3xl font-semibold">
            The families you&apos;re reading to
          </h3>
          <p className="text-lg text-ink/80">Your gift has room for two families. Each one runs its own home, children and approvals.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {[1, 2].map((seat) => {
            const p = gift.places.find((x) => x.seat === seat && x.state !== "ended") ?? gift.places.find((x) => x.seat === seat);
            return p && p.state !== "ended" ? (
              <FamilyCard key={seat} place={p} gift={gift} onRemove={() => setRemoving(p)} onUndo={() => act(`/api/sponsorships/${gift.id}/places/${seat}`, { action: "undo" })} />
            ) : (
              <FreePlace key={seat} seat={seat} gift={gift} previous={p ?? null} onOffer={(body) => act(`/api/sponsorships/${gift.id}/places/${seat}`, { action: "offer", ...body })} />
            );
          })}
        </div>
      </section>

      {!ended && live.length > 0 && <CreditSplit gift={gift} places={live} onSave={(shares) => act(`/api/sponsorships/${gift.id}/credits`, { shares })} />}

      <div className="flex items-start gap-4 rounded-[var(--radius-panel)] bg-mint/25 p-5 sm:p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-mint-deep">
          <LockIcon />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-display text-xl font-semibold">Their bedtime stays theirs</p>
          <p>You see whether each family has joined and how many credits it uses. Their children, books and listening stay private to them.</p>
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t-2 border-dashed border-ink/15 pt-6 text-sm text-muted">
        <p className="font-semibold text-ink">Gift details</p>
        <p>{summary(gift)}</p>
        {gift.plan === "annual" && gift.status === "active" && gift.paidThrough && (
          <p>Your year ends {lastDay(gift.paidThrough)}. We&apos;ll ask you 30 days before whether to give another year. Nothing renews without you.</p>
        )}
        {!ended && gift.status !== "canceling" && (
          <button type="button" className="self-start font-semibold text-ink/80 underline underline-offset-4 hover:text-ink" onClick={() => setCanceling(true)}>
            Cancel the gift and see refund rules
          </button>
        )}
      </footer>

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

/** Sent, opened, joined: three stars that fill in as the family gets closer to their first story. */
function Journey({ place, gift }: { place: PlaceView; gift: GiftView }) {
  const stage = STAGE[place.state];
  const steps = [
    { label: place.state === "arrives" ? `Arrives ${day(gift.deliverAt).replace(/, \d{4}$/, "")}` : "Sent", done: stage >= 1 },
    { label: place.openedAt && stage === 2 ? `Opened ${day(place.openedAt).replace(/, \d{4}$/, "")}` : "Opened", done: stage >= 2 },
    { label: place.joinedAt ? `Joined ${day(place.joinedAt).replace(/, \d{4}$/, "")}` : "Joined", done: stage >= 3 },
  ];
  return (
    <ol className="grid grid-cols-3" aria-label="Invitation progress">
      {steps.map((s, i) => (
        <li key={i} className="relative flex flex-col items-center gap-1 text-center">
          {i > 0 && <span className={`absolute top-5 right-1/2 -z-0 h-1 w-full -translate-y-1/2 rounded-full ${s.done ? "bg-sunshine" : "bg-ink/10"}`} aria-hidden="true" />}
          <StarSticker done={s.done} className="relative z-10 size-10" />
          <span className={`text-sm ${s.done ? "font-semibold" : "text-muted"}`}>
            {s.label}
            <span className="sr-only">{s.done ? ", done" : ", not yet"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function FamilyCard({ place, gift, onRemove, onUndo }: { place: PlaceView; gift: GiftView; onRemove: () => void; onUndo: () => void }) {
  const s = STATE[place.state];
  const t = tone(place.seat);
  const used = Math.min(place.usedThisMonth, place.creditShare);
  const pct = place.creditShare ? Math.round((used / place.creditShare) * 100) : 0;
  const nudge =
    place.state === "arrives"
      ? "Their invitation is wrapped and waiting for the big day."
      : place.state === "invited"
        ? "Your invitation is in their inbox. A quick text to say it's there can help."
        : place.state === "opened"
          ? "They've opened your gift. Their first story is one tap away."
          : place.state === "joined"
            ? "They're in. Bedtime stories are happening, thanks to you."
            : null;
  return (
    <article className={`flex flex-col overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[0_18px_40px_-28px_rgba(40,53,72,0.5)] ring-2 ${t.ring}`} data-testid={`place-${place.seat}`}>
      <div className={`flex flex-wrap items-center gap-3 px-5 py-4 ${t.soft}`}>
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-sm">
          <HouseIcon />
        </span>
        <h4 className="min-w-0 flex-1 font-display text-2xl leading-tight font-semibold break-words">{place.name}</h4>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${s.tone}`}>{s.label}</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <Journey place={place} gift={gift} />
        {nudge && <p className="text-base">{nudge}</p>}
        <div className="flex flex-col gap-3 rounded-2xl bg-ivory p-4 text-sm">
          <div className="flex items-center gap-2">
            <MicIcon />
            <span>
              <span className="font-semibold">Your voice: </span>
              {place.voice === "approved"
                ? "Approved by the parents"
                : place.voice === "waiting"
                  ? "Shared, waiting for the parents"
                  : place.voice === "offered"
                    ? "Shared once they join"
                    : "Not shared"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <BookIcon />
              <span>
                <span className="font-semibold">Story credits this month: </span>
                {place.usedThisMonth.toLocaleString("en-US")} of {place.creditShare} used
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-ink/10" role="presentation">
              <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
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
            <button type="button" className="mt-auto self-start text-sm text-muted underline underline-offset-4 hover:text-ink" onClick={onRemove}>
              Remove this family
            </button>
          )
        )}
      </div>
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
    <article className="flex flex-col gap-4 rounded-[var(--radius-panel)] border-[3px] border-dashed border-coral/50 bg-sunshine/15 p-5 sm:p-6" data-testid={`free-place-${seat}`}>
      <div className="flex items-center gap-4">
        <EnvelopeArt className="w-20 shrink-0" />
        <div className="flex flex-col gap-1">
          <h4 className="font-display text-2xl font-semibold">Room for one more family</h4>
          <p className="text-base">Cousins, a godchild, a friend&apos;s little ones. This place comes with its own share of stories.</p>
        </div>
      </div>
      {previous && <p className="text-sm text-muted">{previous.name} no longer has your gift.</p>}
      {!canOffer ? (
        <p className="text-sm">You can offer this place to another family once your gift has arrived.</p>
      ) : !gift.canChangeFamilies ? (
        <p className="text-sm">You&apos;ve changed families twice in the last 12 months, so this place can&apos;t go to another family yet.</p>
      ) : open ? (
        <form
          className="flex flex-col gap-2 rounded-2xl bg-surface p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onOffer({ name, email, shareVoice })) setOpen(false);
          }}
        >
          <label htmlFor={`${id}-n`} className="text-sm font-semibold">
            Family name
          </label>
          <input id={`${id}-n`} className="min-h-11 rounded-2xl border-2 border-ink/20 px-3" placeholder="The Lee family" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
          <label htmlFor={`${id}-e`} className="text-sm font-semibold">
            A parent&apos;s email
          </label>
          <input id={`${id}-e`} type="email" className="min-h-11 rounded-2xl border-2 border-ink/20 px-3" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={shareVoice} onChange={(e) => setShareVoice(e.target.checked)} /> Share my voice with this family
          </label>
          <button type="submit" className={`${buttonPrimary} mt-1`}>
            Send the invitation
          </button>
        </form>
      ) : (
        <button type="button" className={`${buttonPrimary} self-start`} onClick={() => setOpen(true)}>
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
    <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[0_18px_40px_-28px_rgba(40,53,72,0.5)] ring-2 ring-ink/10 sm:p-6" aria-labelledby={`split-${gift.id}`}>
      <div className="flex flex-col gap-1">
        <h3 id={`split-${gift.id}`} className="font-display text-2xl font-semibold">
          Share out the stories
        </h3>
        <p>
          Your gift brings {SPONSORED.monthlyCredits} story credits a month. Each family starts with 20. If one family listens more, move credits their way in steps of 5 for the next gift month; this month stays as it is.
        </p>
      </div>
      <div className="flex h-4 overflow-hidden rounded-full bg-ink/10" role="presentation">
        {places.map((p) => (
          <div key={p.seat} className={`h-full transition-[width] duration-300 ${tone(p.seat).bar}`} style={{ width: `${(shares[p.seat]! / SPONSORED.monthlyCredits) * 100}%` }} />
        ))}
      </div>
      {places.map((p) => (
        <div key={p.seat} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            <span className={`size-3 shrink-0 rounded-full ${tone(p.seat).bar}`} aria-hidden="true" />
            <span className="break-words">{p.name}</span>
          </span>
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
      {gift.nextMonthFrom && <p className="text-sm text-muted">Changes start {day(gift.nextMonthFrom)}. We&apos;ll let the family know before they do. You see how many credits each family uses, never which stories.</p>}
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

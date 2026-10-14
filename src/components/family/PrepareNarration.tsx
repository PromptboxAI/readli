"use client";

import { displayCredits } from "@/lib/narration/credits";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import type { GenerationQuote, PrepareBookView, PrepareVoiceView } from "@/lib/narration/narration";
import { StorytellerAvatar } from "./StorytellerAvatar";
import { Toggle } from "./Toggle";

/** Units (characters) as credits, to one decimal place. */
const n = (units: number) => displayCredits(units).toLocaleString("en-US");
const duration = (seconds: number) => (seconds < 60 ? `about ${seconds} seconds` : `about ${Math.round((seconds / 60) * 10) / 10} minutes`);

const BADGE: Record<string, string> = {
  ready: "bg-mint",
  partial: "bg-sunshine",
  preparing: "bg-sky/60",
  available: "bg-lavender/60",
  needs_credits: "bg-coral/30",
  unavailable: "bg-ink/10",
};

type Target = { voiceId: string; scope: "book" | "chapter"; chapter?: number };

/**
 * Parent book page: which narrators are ready, what preparing the rest costs in Readli credits, and
 * a confirmation before anything is generated (Book Discovery & Generation Credits amendment §2–4).
 * `resume` reopens the confirmation after buying credits, so the parent doesn't choose again.
 */
export function PrepareNarration({ initial, resume }: { initial: PrepareBookView; resume: Target | null }) {
  const [view, setView] = useState(initial);
  const [pending, setPending] = useState<{ target: Target; quote: GenerationQuote } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const url = `/api/family/books/${view.book.slug}/narration`;
  const preparing = view.voices.some((v) => v.status.readiness === "preparing");
  const balance = view.credits.available;

  const reload = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) setView((await res.json()) as PrepareBookView);
  }, [url]);

  useEffect(() => {
    if (!preparing) return;
    const id = window.setInterval(reload, 1500);
    return () => window.clearInterval(id);
  }, [preparing, reload]);

  const call = useCallback(
    async (init: RequestInit, target = url) => {
      setBusy(true);
      setMessage(null);
      const res = await fetch(target, init);
      const body = await res.json().catch(() => null);
      setBusy(false);
      if (!res.ok) {
        setMessage(body?.error?.message ?? "We couldn't do that. Please try again.");
        return null;
      }
      return body;
    },
    [url],
  );

  /** Shows the quote. Nothing is generated until the parent confirms. */
  const estimate = useCallback(
    async (target: Target) => {
      const body = await call({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(target) });
      if (body) setPending({ target, quote: body.quote as GenerationQuote });
    },
    [call],
  );

  const resumed = useRef(false);
  useEffect(() => {
    if (resume && !resumed.current) {
      resumed.current = true;
      void estimate(resume);
    }
  }, [resume, estimate]);

  const confirm = async () => {
    if (!pending) return;
    const body = await call({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...pending.target, confirm: true }) });
    if (body) {
      setView(body.view as PrepareBookView);
      setMessage(`Preparing now. We'll let you know when it's ready.`);
    }
    setPending(null);
  };

  const cancel = async (voice: PrepareVoiceView) => {
    if (!voice.jobId) return;
    const body = await call({ method: "DELETE" }, `${url}?jobId=${voice.jobId}`);
    if (body) {
      setView(body as PrepareBookView);
      setMessage("Stopped. Anything already prepared stays, and unused credits were returned.");
    }
  };

  /** One setup step done in place (share, narrator slot, a child's approval), then the page reloads. */
  const setUp = async (target: string, method: "POST" | "PUT", body: unknown, done: string) => {
    const ok = await call({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, target);
    if (ok) {
      await reload();
      setMessage(done);
    }
  };

  const creditsLink = (v: PrepareVoiceView, need: number, target: Target) => {
    const back = `/family/books/${view.book.slug}?voice=${v.voiceId}&scope=${target.scope}${target.chapter ? `&chapter=${target.chapter}` : ""}`;
    return `/family/credits?need=${Math.ceil(need / view.credits.unitsPerCredit)}&return=${encodeURIComponent(back)}`;
  };

  return (
    <div className="flex flex-col gap-8" data-testid="prepare-narration">
      <div className="flex flex-col gap-3">
        <Link href="/family/books" className="font-semibold underline underline-offset-4">
          ← Family library
        </Link>
        <div className="flex flex-wrap items-center gap-5">
          {view.book.coverUrl ? (
            <Image src={view.book.coverUrl} alt="" width={150} height={200} className="aspect-[3/4] w-32 shrink-0 rounded-2xl object-cover ring-2 ring-ink/10 sm:w-36" priority />
          ) : (
            <span className={`flex aspect-[3/4] w-32 shrink-0 items-center justify-center rounded-2xl p-3 text-center font-display text-lg font-semibold ${view.book.tint}`}>{view.book.title}</span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="font-display text-4xl font-semibold">{view.book.title}</h1>
            <p className="text-lg text-muted">
              {view.book.author} · {view.book.minutes < 1 ? "under a minute" : `about ${view.book.minutes} minutes`}
              {view.book.chapters > 1 ? ` · ${view.book.chapters} chapters` : ""}
            </p>
            <p className="max-w-2xl text-lg">
              Choose a storyteller and prepare the audiobook. When it&apos;s ready you can play it here, and the kids you choose
              find it on their bookshelf. Listening again never uses credits.
            </p>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-2 rounded-panel bg-sky/30 p-5 sm:flex-row sm:items-center sm:gap-4" aria-label="Readli credits" data-testid="credits">
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-semibold" data-testid="balance">
            {n(balance)} Readli credits
          </p>
          <p className="text-sm text-muted">
            {n(view.credits.bySource.subscription + view.credits.bySource.trial)} {view.credits.bySource.trial ? "trial" : "monthly"}, {n(view.credits.bySource.promotional)} promotional,{" "}
            {n(view.credits.bySource.purchased)} purchased.
            {view.credits.held > 0 ? ` ${n(view.credits.held)} set aside for narration being prepared.` : ""}
          </p>
        </div>
        <Link href="/family/credits" className="font-semibold underline underline-offset-4">
          Credits and history
        </Link>
      </section>

      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>

      <ul className="flex flex-col gap-4">
        {view.voices.map((v) => {
          const pct = Math.round((v.status.ready / v.status.total) * 100);
          const book: Target = { voiceId: v.voiceId, scope: "book" };
          const openFor = (t: Target) => pending?.target.voiceId === v.voiceId && pending.target.scope === t.scope && pending.target.chapter === t.chapter;
          return (
            <li key={v.voiceId} data-testid={`prepare-${v.voiceId}`} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
              <div className="flex flex-wrap items-center gap-4">
                <StorytellerAvatar name={v.name} avatarUrl={v.avatarUrl} tint={v.tint} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-semibold">{v.name}</p>
                  {v.yours && <p className="text-sm text-muted">Your voice</p>}
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${BADGE[v.availability]}`} data-testid="availability">
                  {v.availabilityLabel}
                </span>
                {v.canListen && (
                  <Link href={`/family/books/${view.book.slug}/listen?voice=${v.voiceId}`} className={buttonSecondary}>
                    Listen
                  </Link>
                )}
              </div>

              <Setup
                view={view}
                voice={v}
                busy={busy}
                onShare={() => setUp(`/api/family/voices/${v.voiceId}/share`, "PUT", { householdId: view.householdId, shared: true }, "Your voice is shared with this family.")}
                onSlot={() => setUp("/api/family/narrators", "POST", { voiceId: v.voiceId, action: "activate" }, `${v.name} is in a narrator slot.`)}
                onApprove={(kid, approved) =>
                  setUp(
                    `/api/family/kids/${kid.id}/storytellers`,
                    "PUT",
                    { changes: [{ voiceId: v.voiceId, approved }] },
                    approved ? `${kid.name} can listen to ${v.name}.` : `${kid.name} can no longer listen to ${v.name}.`,
                  )
                }
              />

              <div className="flex flex-col gap-1">
                <div className="h-3 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${v.name}: ${pct}% prepared`}>
                  <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-sm text-muted" data-testid="readiness">
                  {v.readinessLabel}: {v.status.ready} of {v.status.total} sentences prepared
                  {v.status.inProgress ? `, ${v.status.inProgress} being prepared` : ""}
                </p>
              </div>

              {v.lastFailure && v.status.readiness !== "preparing" && (
                <p className="rounded-2xl bg-coral/20 p-3 text-sm font-semibold" data-testid="last-failure">
                  {v.lastFailure} You can try again.
                </p>
              )}

              {v.status.readiness === "ready" && v.canListen && (
                <div className="flex flex-col gap-2 rounded-3xl bg-mint/40 p-4" data-testid="ready-to-play">
                  <p className="font-display text-xl font-semibold">Ready to play</p>
                  <p className="text-sm">
                    {v.approvedFor.length
                      ? `It's on ${v.approvedFor.join(" and ")}'s bookshelf in Readli Kids.`
                      : "Choose which kids can listen above to put it on their bookshelf."}
                  </p>
                  <Link href={`/family/books/${view.book.slug}/listen?voice=${v.voiceId}`} className={`${buttonPrimary} self-start`}>
                    Play now
                  </Link>
                </div>
              )}

              {v.availability === "unavailable" ? (
                v.unavailableReason === "Needs Readli Family" && v.fix ? (
                  <p className="text-sm font-semibold">
                    {v.unavailableReason}.{" "}
                    <Link href={v.fix.href} className="underline underline-offset-4">
                      {v.fix.label}
                    </Link>
                  </p>
                ) : null
              ) : v.status.readiness === "preparing" ? (
                v.jobId && (
                  <button type="button" className={`${buttonSecondary} self-start`} disabled={busy} onClick={() => cancel(v)}>
                    Stop preparing
                  </button>
                )
              ) : v.missingCredits > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className={buttonPrimary} disabled={busy || v.missingCredits > balance} onClick={() => estimate(book)}>
                      {v.status.ready ? "Prepare the rest" : "Prepare Audiobook"} · {n(v.missingCredits)} credits
                    </button>
                    {v.missingCredits > balance && view.canBuyCredits && (
                      <Link href={creditsLink(v, v.missingCredits - balance, book)} className={buttonSecondary} data-testid="get-credits">
                        Get More Narration Credits
                      </Link>
                    )}
                  </div>
                  {v.missingCredits > balance && (
                    <p className="text-sm font-semibold" data-testid="credits-needed">
                      You need {n(v.missingCredits - balance)} more credits for the whole book.
                      {view.chapterGenerationEnabled ? " You can also prepare it a chapter at a time." : ""}
                    </p>
                  )}
                </div>
              ) : null}

              {openFor(book) && pending && <Confirm view={view} voice={v} quote={pending.quote} busy={busy} onConfirm={confirm} onCancel={() => setPending(null)} />}

              {view.chapterGenerationEnabled && v.availability !== "unavailable" && (
                <details className="rounded-2xl bg-ivory p-3" open={v.missingCredits > balance || Boolean(pending && pending.target.voiceId === v.voiceId && pending.target.scope === "chapter")}>
                  <summary className="cursor-pointer font-semibold">Chapters</summary>
                  <ol className="mt-2 flex flex-col gap-2">
                    {v.chapters.map((c) => {
                      const target: Target = { voiceId: v.voiceId, scope: "chapter", chapter: c.number };
                      return (
                        <li key={c.number} className="flex flex-col gap-2" data-testid={`chapter-${c.number}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="min-w-0 flex-1">
                              {c.number}. {c.title}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${BADGE[c.readiness === "not_prepared" ? (c.credits > balance ? "needs_credits" : "available") : c.readiness]}`}>
                              {c.readiness === "ready" ? "Ready" : c.readiness === "preparing" ? "Preparing" : c.readiness === "partial" ? "Partially ready" : c.credits > balance ? "More credits needed" : "Available to generate"}
                            </span>
                            {c.credits > 0 && c.readiness !== "preparing" && (
                              <button type="button" className="rounded-full border-2 border-ink px-3 py-1 text-sm font-semibold disabled:opacity-40" disabled={busy || c.credits > balance} onClick={() => estimate(target)}>
                                Prepare · {n(c.credits)} credits
                              </button>
                            )}
                          </div>
                          {openFor(target) && pending && <Confirm view={view} voice={v} quote={pending.quote} busy={busy} onConfirm={confirm} onCancel={() => setPending(null)} />}
                        </li>
                      );
                    })}
                  </ol>
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {view.voices.length === 0 && <p className="rounded-3xl bg-surface p-4">No storytellers have shared their voice with your family yet.</p>}

      {view.shorterThatFit.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="fit-h" data-testid="shorter-books">
          <h2 id="fit-h" className="font-display text-2xl font-semibold">Shorter stories you can prepare now</h2>
          <ul className="flex flex-col gap-2">
            {view.shorterThatFit.map((b) => (
              <li key={b.slug}>
                <Link href={`/family/books/${b.slug}`} className="font-semibold underline underline-offset-4">
                  {b.title}
                </Link>{" "}
                <span className="text-muted">
                  read by {b.narrator}, {n(b.credits)} credits
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Confirm({
  view,
  voice,
  quote,
  busy,
  onConfirm,
  onCancel,
}: {
  view: PrepareBookView;
  voice: PrepareVoiceView;
  quote: GenerationQuote;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const balance = view.credits.available;
  const what = quote.chapter ? `Chapter ${quote.chapter.number}, ${quote.chapter.title}` : "The whole book";
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-ivory p-4 ring-2 ring-ink/10" data-testid="confirm-generation">
      <p className="font-display text-lg font-semibold">
        Prepare {quote.book.title} read by {voice.name}?
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">What</dt>
        <dd>{what}</dd>
        <dt className="text-muted">Narration</dt>
        <dd>{duration(quote.estimateSeconds)}</dd>
        <dt className="text-muted">Credits</dt>
        <dd data-testid="quote-credits">{n(quote.credits)}</dd>
        <dt className="text-muted">Your balance</dt>
        <dd>{n(balance)}</dd>
        <dt className="text-muted">After this</dt>
        <dd data-testid="quote-after">{n(balance - quote.credits)}</dd>
      </dl>
      <p className="text-sm text-muted">
        {quote.reusedReady ? `${quote.reusedReady} sentences already prepared are free. ` : ""}
        {quote.alreadyQueued ? `${quote.alreadyQueued} are already being prepared, at no cost to you. ` : ""}
        You&apos;re never charged more than this; unused credits come back.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonPrimary} disabled={busy || quote.credits > balance} onClick={onConfirm}>
          Prepare now
        </button>
        <button type="button" className={buttonSecondary} onClick={onCancel}>
          Not now
        </button>
      </div>
    </div>
  );
}

/**
 * What a storyteller needs before their audiobook can be prepared and heard, each done in place:
 * the owner's share (only the owner can give it, so only your own voice gets a button), a narrator
 * slot (within the family's slots), and which children may listen.
 */
function Setup({
  view,
  voice: v,
  busy,
  onShare,
  onSlot,
  onApprove,
}: {
  view: PrepareBookView;
  voice: PrepareVoiceView;
  busy: boolean;
  onShare: () => void;
  onSlot: () => void;
  onApprove: (kid: PrepareVoiceView["kids"][number], approved: boolean) => void;
}) {
  if (v.unavailableReason === "Needs Readli Family") return null;
  const done = (text: string) => (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-mint text-sm font-bold">
        ✓
      </span>
      {text}
    </li>
  );
  const todo = (text: string, action: React.ReactNode) => (
    <li className="flex flex-wrap items-center gap-2">
      <span aria-hidden="true" className="size-6 rounded-full border-2 border-ink/40" />
      <span className="min-w-0 flex-1 font-semibold">{text}</span>
      {action}
    </li>
  );
  return (
    <ol className="flex flex-col gap-2 rounded-2xl bg-ivory p-3 text-sm" aria-label={`Getting ${v.name} ready`} data-testid="setup">
      {done("Voice recorded and ready")}
      {v.shared
        ? done(v.yours ? "Your voice is shared with this family" : "Shared with your family")
        : v.yours
          ? todo(
              "Share your voice with this family",
              <button type="button" className={buttonPrimary} disabled={busy} onClick={onShare}>
                Share my voice
              </button>,
            )
          : todo(`Waiting for ${v.name} to share their voice`, null)}
      {v.inSlot
        ? done("In a narrator slot")
        : view.freeSlots > 0
          ? todo(
              `Not in a narrator slot yet (${view.freeSlots} free)`,
              <button type="button" className={buttonPrimary} disabled={busy || !v.shared} onClick={onSlot}>
                Use a narrator slot
              </button>,
            )
          : todo(
              "Not in a narrator slot, and all your slots are in use",
              <Link href="/family/narrators" className="font-semibold underline underline-offset-4">
                Free up a slot
              </Link>,
            )}
      {v.kids.length === 0 ? (
        todo(
          "Add a child to choose who can listen",
          <Link href="/family/kids" className="font-semibold underline underline-offset-4">
            Add a child
          </Link>,
        )
      ) : (
        <li className="flex flex-col gap-2">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className={`flex size-6 items-center justify-center rounded-full text-sm font-bold ${v.approvedFor.length ? "bg-mint" : "border-2 border-ink/40"}`}>
              {v.approvedFor.length ? "✓" : ""}
            </span>
            <span className={v.approvedFor.length ? "" : "font-semibold"}>Who can listen{v.inSlot ? "" : " (after the narrator slot)"}</span>
          </span>
          <ul className="flex flex-wrap gap-3 pl-8">
            {v.kids.map((k) => (
              <li key={k.id} className="flex items-center gap-2">
                <Toggle checked={k.approved} disabled={busy || !v.inSlot} label={`${v.name} for ${k.name}`} onChange={(next) => onApprove(k, next)} />
                <span className="font-semibold">{k.name}</span>
              </li>
            ))}
          </ul>
        </li>
      )}
    </ol>
  );
}

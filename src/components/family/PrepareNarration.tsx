"use client";

import { displayCredits } from "@/lib/narration/credits";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Availability, BookUpdate, GenerationQuote, PrepareBookView, PrepareVoiceView } from "@/lib/narration/narration";
import { GiftShortOptions } from "@/components/sponsorship/GiftShortOptions";
import { StorytellerAvatar } from "./StorytellerAvatar";

/** Units (characters) as credits, to one decimal place. */
const n = (units: number) => displayCredits(units).toLocaleString("en-US");
const duration = (seconds: number) => (seconds < 60 ? `about ${seconds} seconds` : `about ${Math.round((seconds / 60) * 10) / 10} minutes`);

/** Parent Portal controls: plain, rectangular, one strong action per area. */
const btn = "inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-40";
const btnPrimary = `${btn} bg-ink text-white hover:bg-ink/90`;
const btnAccent = `${btn} bg-coral-deep text-white hover:bg-coral-deep/90`;
const btnSecondary = `${btn} border border-ink/25 bg-surface text-ink hover:bg-ivory`;
const btnSmall = "inline-flex min-h-9 items-center rounded-md border border-ink/25 bg-surface px-3 text-sm font-semibold hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-40";
const card = "rounded-xl border border-ink/10 bg-surface";

/** The one status a parent sees for a narrator on this book. */
const STATUS: Record<Availability, { label: string; tone: string }> = {
  ready: { label: "Ready", tone: "bg-mint/50 text-mint-deep" },
  partial: { label: "Partly ready", tone: "bg-sky/30 text-ink" },
  preparing: { label: "In progress", tone: "bg-sky/30 text-ink" },
  available: { label: "Not prepared", tone: "bg-ink/5 text-muted" },
  needs_credits: { label: "Needs credits", tone: "bg-sunshine/40 text-[#7a4b00]" },
  unavailable: { label: "Needs setup", tone: "bg-ink/5 text-muted" },
};

const CHAPTER_STATUS = { ready: "Ready", preparing: "In progress", partial: "Partly ready", not_prepared: "Not prepared" } as const;

function StatusBadge({ availability, testId }: { availability: Availability; testId?: string }) {
  const s = STATUS[availability];
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${s.tone}`} data-testid={testId}>
      {s.label}
    </span>
  );
}

type Target = { voiceId: string; scope: "book" | "chapter"; chapter?: number };

/** Who opens first: the narrator being resumed or asked for, then your own voice, then the first storyteller. */
function firstVoice(view: PrepareBookView, resume: Target | null, prefer: string | null) {
  const wanted = resume?.voiceId ?? prefer;
  return (wanted && view.voices.find((v) => v.voiceId === wanted)?.voiceId) ?? view.voices.find((v) => v.yours)?.voiceId ?? view.voices[0]?.voiceId ?? null;
}

/**
 * Parent book page: choose a narrator, finish any one-time setup in place, see what preparing the
 * whole book or a chapter costs in Readli credits, and confirm before anything is generated.
 * `resume` reopens the confirmation after buying credits, so the parent doesn't choose again.
 */
export function PrepareNarration({ initial, resume, prefer = null }: { initial: PrepareBookView; resume: Target | null; prefer?: string | null }) {
  const [view, setView] = useState(initial);
  const [selected, setSelected] = useState<string | null>(() => firstVoice(initial, resume, prefer));
  const [pending, setPending] = useState<{ target: Target; quote: GenerationQuote } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const url = `/api/family/books/${view.book.slug}/narration`;
  // An update being prepared counts too: the old audiobook still reads as Ready while it runs.
  const preparing = view.voices.some((v) => v.status.readiness === "preparing" || v.jobId !== null);
  const balance = view.credits.available;
  const v = view.voices.find((x) => x.voiceId === selected) ?? null;
  // A narration with a newer version of the story to update to; the selected narrator's first.
  const updatable = [v, ...view.voices].find((x) => x?.update && !x.jobId) ?? null;

  const reload = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) setView((await res.json()) as PrepareBookView);
  }, [url]);

  useEffect(() => {
    if (!preparing) return;
    const id = window.setInterval(reload, 1500);
    return () => window.clearInterval(id);
  }, [preparing, reload]);

  // When a book finishes preparing, every page the browser kept (Home's bookshelf, the credit
  // balance) is asked for again, so none shows the family as it was before.
  const router = useRouter();
  const wasPreparing = useRef(preparing);
  useEffect(() => {
    if (wasPreparing.current && !preparing) router.refresh();
    wasPreparing.current = preparing;
  }, [preparing, router]);

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
  const setUp = async (target: string, method: "POST" | "PUT", body: unknown, done: string): Promise<boolean> => {
    setEditing(true);
    const ok = await call({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, target);
    if (ok) {
      await reload();
      setMessage(done);
    }
    return Boolean(ok);
  };

  const choose = (id: string) => {
    setSelected(id);
    setPending(null);
    setEditing(false);
  };

  const creditsLink = (voice: PrepareVoiceView, need: number, target: Target) => {
    const back = `/family/books/${view.book.slug}?voice=${voice.voiceId}&scope=${target.scope}${target.chapter ? `&chapter=${target.chapter}` : ""}`;
    return `/family/settings/plan?need=${Math.ceil(need / view.credits.unitsPerCredit)}&return=${encodeURIComponent(back)}`;
  };

  const openFor = (t: Target) => pending?.target.voiceId === t.voiceId && pending.target.scope === t.scope && pending.target.chapter === t.chapter;
  const confirmFor = (voice: PrepareVoiceView) =>
    pending && <Confirm view={view} voice={voice} quote={pending.quote} busy={busy} onConfirm={confirm} onCancel={() => setPending(null)} />;

  return (
    <div className="flex flex-col gap-7" data-testid="prepare-narration">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
        <Link href="/family/books" className="flex min-h-11 items-center font-semibold text-ink underline-offset-4 hover:underline" data-testid="back-link">
          <span aria-hidden="true" className="mr-1 sm:hidden">
            ←
          </span>
          Family library
        </Link>
        <span aria-hidden="true" className="hidden sm:inline">
          /
        </span>
        <span className="hidden sm:inline">{view.book.title}</span>
      </nav>

      {updatable && !pending && (
        <div className="flex flex-col gap-3 rounded-2xl bg-sunshine/60 p-4 sm:flex-row sm:items-center sm:justify-between" role="status" data-testid="update-banner">
          <p>
            <strong>An updated version of this story is available</strong> for {updatable.name}&apos;s audiobook.{" "}
            {updatable.update!.free || updatable.update!.credits === 0 ? "Updating is free." : `Updating costs ${n(updatable.update!.credits)} credits.`}
          </p>
          <button
            type="button"
            className={`${btnPrimary} shrink-0 self-start sm:self-center`}
            disabled={busy}
            onClick={() => {
              setSelected(updatable.voiceId);
              void estimate({ voiceId: updatable.voiceId, scope: "book" }).then(() =>
                requestAnimationFrame(() => document.querySelector('[data-testid="confirm-generation"]')?.scrollIntoView({ behavior: "smooth", block: "center" })),
              );
            }}
          >
            Update audiobook
          </button>
        </div>
      )}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
        {view.book.coverUrl ? (
          <Image src={view.book.coverUrl} alt="" width={190} height={253} className="aspect-[3/4] w-28 shrink-0 rounded-lg object-cover shadow-md sm:w-44" priority />
        ) : (
          <span className={`flex aspect-[3/4] w-28 shrink-0 items-center justify-center rounded-lg p-3 text-center font-display text-lg font-semibold sm:w-44 ${view.book.tint}`}>{view.book.title}</span>
        )}
        <div className="flex min-w-0 flex-col gap-3 sm:pt-2">
          {v && <StatusBadge availability={v.availability} testId="book-status" />}
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{view.book.title}</h1>
          <p className="text-muted">
            {view.book.author} · {view.book.minutes < 1 ? "under a minute" : `about ${view.book.minutes} minutes`}
            {view.book.chapters > 1 ? ` · ${view.book.chapters} chapters` : ""}
          </p>
          <p className="max-w-2xl">
            Prepare this book once in a family voice. You can then play it here, and every child you approve finds it on their Readli Kids bookshelf.
            Listening again never uses credits.
          </p>
        </div>
      </header>

      <ol aria-label="How preparation works" className={`${card} grid divide-y divide-ink/10 text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0`}>
        <li className="flex gap-3 px-4 py-3">
          <span className="font-bold text-muted">1</span>
          <span>
            <strong>Choose a narrator.</strong> Any voice shared with your family.
          </span>
        </li>
        <li className="flex gap-3 px-4 py-3">
          <span className="font-bold text-muted">2</span>
          <span>
            <strong>Prepare.</strong> {view.chapterGenerationEnabled ? "The whole book, or one chapter at a time." : "The whole story in one go."}
          </span>
        </li>
        <li className="flex gap-3 px-4 py-3">
          <span className="font-bold text-muted">3</span>
          <span>
            <strong>Listen.</strong> Here, and on approved kids&apos; bookshelves.
          </span>
        </li>
      </ol>

      <p role="status" aria-live="polite" className={message ? "rounded-lg bg-ivory p-3 font-semibold ring-1 ring-ink/10" : "sr-only"}>
        {message}
      </p>

      {view.voices.length === 0 ? (
        <p className={`${card} p-4`}>No storytellers have shared their voice with your family yet.</p>
      ) : (
        v && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" data-testid={`prepare-${v.voiceId}`}>
            <div className="flex min-w-0 flex-col gap-6">
              <section aria-labelledby="narrator-h" className={card}>
                <h2 id="narrator-h" className="border-b border-ink/10 px-5 py-4 text-lg font-bold">
                  Narrator
                </h2>
                {view.voices.length > 1 && (
                  <ul aria-label="Choose a narrator" className="divide-y divide-ink/10 border-b border-ink/10">
                    {view.voices.map((x) => (
                      <li key={x.voiceId}>
                        <button
                          type="button"
                          aria-pressed={x.voiceId === v.voiceId}
                          onClick={() => choose(x.voiceId)}
                          className={`flex w-full items-center gap-3 px-5 py-3 text-left ${x.voiceId === v.voiceId ? "bg-ivory" : "hover:bg-ivory/60"}`}
                          data-testid={`narrator-${x.voiceId}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`size-4 shrink-0 rounded-full border-2 ${x.voiceId === v.voiceId ? "border-[5px] border-ink" : "border-ink/30"}`}
                          />
                          <StorytellerAvatar name={x.name} avatarUrl={x.avatarUrl} tint={x.tint} size="xs" />
                          <span className="min-w-0 flex-1 font-semibold">
                            {x.name}
                            {x.yours && <span className="font-normal text-muted"> (your voice)</span>}
                          </span>
                          <StatusBadge availability={x.availability} testId="availability" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <NarratorDetails
                  view={view}
                  voice={v}
                  busy={busy}
                  showSetup={editing || !v.shared || !v.inSlot || v.approvedFor.length === 0}
                  onEdit={() => setEditing(true)}
                  onDone={editing && v.shared && v.inSlot && v.approvedFor.length > 0 ? () => setEditing(false) : null}
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
              </section>

              {view.chapterGenerationEnabled && v.availability !== "unavailable" && (
                <section id="chapters" aria-labelledby="chapters-h" className={card}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/10 px-5 py-4">
                    <h2 id="chapters-h" className="text-lg font-bold">
                      Prepare by chapter
                    </h2>
                    <p className="text-sm text-muted">Each chapter is charged once, then it&apos;s free to replay.</p>
                  </div>
                  <div className="hidden grid-cols-[2rem_minmax(0,1fr)_5rem_7rem_6.5rem] gap-3 px-5 py-2 text-xs font-bold uppercase tracking-wide text-muted sm:grid" aria-hidden="true">
                    <span>#</span>
                    <span>Chapter</span>
                    <span className="text-right">Credits</span>
                    <span>Status</span>
                    <span />
                  </div>
                  <ol className="divide-y divide-ink/10 border-t border-ink/10 sm:border-t-0">
                    {v.chapters.map((c) => {
                      const target: Target = { voiceId: v.voiceId, scope: "chapter", chapter: c.number };
                      return (
                        <li key={c.number} className="flex flex-col gap-3 px-5 py-3" data-testid={`chapter-${c.number}`}>
                          <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[2rem_minmax(0,1fr)_5rem_7rem_6.5rem]">
                            <span className="self-start text-muted tabular-nums sm:self-center">{c.number}</span>
                            <span className="min-w-0">
                              {c.title}
                              <span className="block text-sm text-muted sm:hidden">
                                {c.credits > 0 ? `${n(c.credits)} credits · ` : ""}
                                {CHAPTER_STATUS[c.readiness]}
                              </span>
                            </span>
                            <span className="hidden text-right tabular-nums sm:block">{c.credits > 0 ? n(c.credits) : "—"}</span>
                            <span className="hidden text-muted sm:block">{CHAPTER_STATUS[c.readiness]}</span>
                            <span className="text-right">
                              {c.credits > 0 && c.readiness !== "preparing" && (
                                <button type="button" className={btnSmall} disabled={busy || c.credits > balance} onClick={() => estimate(target)}>
                                  Prepare
                                </button>
                              )}
                            </span>
                          </div>
                          {openFor(target) && confirmFor(v)}
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}
            </div>

            <WholeBook
              view={view}
              voice={v}
              busy={busy}
              onEstimate={() => estimate({ voiceId: v.voiceId, scope: "book" })}
              onCancel={() => cancel(v)}
              getCredits={creditsLink(v, Math.max(0, v.missingCredits - balance), { voiceId: v.voiceId, scope: "book" })}
              confirm={openFor({ voiceId: v.voiceId, scope: "book" }) ? confirmFor(v) : null}
            />
          </div>
        )
      )}

      {view.shorterThatFit.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="fit-h" data-testid="shorter-books">
          <h2 id="fit-h" className="text-lg font-bold">
            Shorter stories you can prepare now
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {view.shorterThatFit.map((b) => (
              <li key={b.slug} className={`${card} flex items-center gap-3 p-3`}>
                {b.coverUrl && <Image src={b.coverUrl} alt="" width={56} height={75} className="aspect-[3/4] w-12 shrink-0 rounded object-cover" />}
                <span className="flex min-w-0 flex-col">
                  <Link href={`/family/books/${b.slug}`} className="font-semibold underline-offset-4 hover:underline">
                    {b.title}
                  </Link>
                  <span className="text-sm text-muted">
                    Read by {b.narrator} · {n(b.credits)} credits
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The whole-book purchase area: cost, what you have, and one clear next step. */
function WholeBook({
  view,
  voice: v,
  busy,
  onEstimate,
  onCancel,
  getCredits,
  confirm,
}: {
  view: PrepareBookView;
  voice: PrepareVoiceView;
  busy: boolean;
  onEstimate: () => void;
  onCancel: () => void;
  getCredits: string;
  confirm: React.ReactNode;
}) {
  const balance = view.credits.available;
  const short = Math.max(0, v.missingCredits - balance);
  const pct = Math.round((v.status.ready / v.status.total) * 100);
  return (
    <aside aria-labelledby="whole-h" className={`${card} flex flex-col gap-4 p-5`}>
      <div>
        <h2 id="whole-h" className="text-lg font-bold">
          {v.status.readiness === "ready" ? "Your audiobook" : "Prepare the whole book"}
        </h2>
        <p className="text-sm text-muted">Read by {v.name}</p>
      </div>

      {v.lastFailure && v.status.readiness !== "preparing" && (
        <p className="rounded-lg bg-coral/15 p-3 text-sm font-semibold" data-testid="last-failure">
          {v.lastFailure} You can try again.
        </p>
      )}

      {v.status.readiness === "ready" && v.canListen ? (
        <div className="flex flex-col gap-3" data-testid="ready-to-play">
          <p className="text-sm">
            {v.approvedFor.length ? `It's on ${v.approvedFor.join(" and ")}'s bookshelf in Readli Kids.` : "Choose who can listen under Narrator to put it on a bookshelf."}
          </p>
          <Link href={`/family/books/${view.book.slug}/listen?voice=${v.voiceId}`} className={btnPrimary}>
            Play now
          </Link>
          {v.update && !confirm && <UpdateAvailable update={v.update} preparing={Boolean(v.jobId)} busy={busy} onEstimate={onEstimate} />}
        </div>
      ) : v.availability === "unavailable" ? (
        <p className="text-sm">
          {v.unavailableReason === "Needs Readli Family" && v.fix ? (
            <>
              {v.unavailableReason}.{" "}
              <Link href={v.fix.href} className="font-semibold underline underline-offset-4">
                {v.fix.label}
              </Link>
            </>
          ) : (
            `Finish setting up ${v.name} under Narrator to prepare this book.`
          )}
        </p>
      ) : v.status.readiness === "preparing" ? (
        <div className="flex flex-col gap-3">
          <div className="h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${v.name}: ${pct}% prepared`}>
            <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm text-muted" data-testid="readiness">
            {v.status.ready} of {v.status.total} sentences prepared
          </p>
          {v.jobId && (
            <button type="button" className={btnSecondary} disabled={busy} onClick={onCancel}>
              Stop preparing
            </button>
          )}
        </div>
      ) : v.missingCredits > 0 ? (
        <>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-y-2 tabular-nums">
            <dt className="text-muted">{v.status.ready ? "Cost of the rest" : "Whole-book cost"}</dt>
            <dd className="text-right font-bold">{n(v.missingCredits)} credits</dd>
            <dt className="text-muted">Credits available</dt>
            <dd className="text-right" data-testid="balance">
              {n(balance)}
            </dd>
            {view.gift && (
              <dd className="col-span-2 text-sm text-muted" data-testid="balance-sources">
                From {view.gift.giverName}&apos;s gift: {n(view.credits.bySource.subscription)} · Bought by you: {n(view.credits.bySource.purchased + view.credits.bySource.promotional)}
              </dd>
            )}
            {short > 0 && (
              <>
                <dt className="border-t border-ink/10 pt-2 text-muted">Still needed</dt>
                <dd className="border-t border-ink/10 pt-2 text-right font-bold text-coral-deep">{n(short)} credits</dd>
              </>
            )}
          </dl>
          {short > 0 && (
            <p className="rounded-lg bg-ivory p-3 text-sm" data-testid="credits-needed">
              You need {n(short)} more credits for the whole book.
              {view.chapterGenerationEnabled ? " You can prepare single chapters now with the credits you have." : ""}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button type="button" className={btnPrimary} disabled={busy || short > 0} onClick={onEstimate}>
              {v.status.ready ? "Prepare the rest" : "Prepare whole book"}
            </button>
            {short > 0 && view.gift && (
              <GiftShortOptions giverName={view.gift.giverName} renewsAt={view.gift.renewsAt} chapters={view.chapterGenerationEnabled} buyCreditsHref={view.canBuyCredits ? getCredits : null} />
            )}
            {short > 0 && !view.gift && view.canBuyCredits && (
              <Link href={getCredits} className={btnAccent} data-testid="get-credits">
                Buy more credits
              </Link>
            )}
            {short > 0 && !view.gift && view.chapterGenerationEnabled && (
              <a href="#chapters" className={btnSecondary}>
                Prepare by chapter
              </a>
            )}
          </div>
          {v.canListen && (
            <Link href={`/family/books/${view.book.slug}/listen?voice=${v.voiceId}`} className="text-sm font-semibold underline underline-offset-4">
              Listen to what&apos;s ready
            </Link>
          )}
          {!confirm && <p className="text-xs text-muted">You confirm the exact charge before anything is prepared. Unused credits come back if preparation stops.</p>}
        </>
      ) : null}

      {confirm}
    </aside>
  );
}

/**
 * One quiet line when Readli has revised a story this family already has as an audiobook. Their
 * audiobook keeps playing as it is; updating goes through the usual quote and confirmation.
 */
function UpdateAvailable({ update, preparing, busy, onEstimate }: { update: BookUpdate; preparing: boolean; busy: boolean; onEstimate: () => void }) {
  const [open, setOpen] = useState(false);
  if (preparing) {
    return (
      <p className="border-t border-ink/10 pt-3 text-sm text-muted" data-testid="book-update">
        Preparing the updated version. Your current audiobook keeps playing until it&apos;s ready.
      </p>
    );
  }
  const cost = update.free || update.credits === 0 ? "Free" : `${n(update.credits)} credits`;
  return (
    <div className="flex flex-col gap-3 border-t border-ink/10 pt-3 text-sm" data-testid="book-update">
      <div className="flex flex-col gap-0.5">
        <p className="font-semibold">An updated version of this story is available</p>
        <p className="text-muted">
          {update.changed === 1 ? "1 line reads differently." : `${update.changed} lines read differently.`}{" "}
          {update.free ? "This is a Readli correction, so updating is free." : "Lines that haven't changed are reused at no cost."} Your current
          audiobook keeps playing until the update is ready.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" className={btnSecondary} disabled={busy} onClick={onEstimate} data-testid="book-update-start">
          Update audiobook · <span data-testid="book-update-cost">{cost}</span>
        </button>
        <button type="button" className="font-semibold underline underline-offset-4" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Hide what changed" : "See what changed"}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 rounded-lg bg-ivory p-3" data-testid="book-update-details">
          {update.before.length > 0 && (
            <div>
              <p className="font-semibold">Your audiobook says</p>
              <ul className="list-disc pl-5">
                {update.before.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {update.after.length > 0 && (
            <div>
              <p className="font-semibold">The update says</p>
              <ul className="list-disc pl-5">
                {update.after.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
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
    <div className="flex flex-col gap-3 rounded-lg border border-ink/15 bg-ivory p-4" data-testid="confirm-generation">
      <p className="font-bold">
        Prepare {quote.book.title} read by {voice.name}?
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums">
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
        {quote.free ? "This is a Readli correction to a story you already have, so it's free. " : ""}
        {quote.reusedReady ? `${quote.reusedReady} sentences already prepared are free. ` : ""}
        {quote.alreadyQueued ? `${quote.alreadyQueued} are already being prepared, at no cost to you. ` : ""}
        You&apos;re never charged more than this; unused credits come back.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={busy || quote.credits > balance} onClick={onConfirm}>
          Prepare now
        </button>
        <button type="button" className={btnSecondary} onClick={onCancel}>
          Not now
        </button>
      </div>
    </div>
  );
}

/**
 * A compact on/off switch for adult settings. It slides as soon as it is tapped and stays there
 * while the change saves; the saved value from the server then decides, so a failed save slides
 * it back. Other taps wait while a change is saving, without greying anything out.
 */
function Switch({
  checked,
  disabled,
  busy,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  label: string;
  onChange: (next: boolean) => Promise<boolean>;
}) {
  // The tapped value until the save settles; then the server's saved value again.
  const [pending, setPending] = useState<boolean | null>(null);
  const shown = pending ?? checked;
  const toggle = async () => {
    if (busy || pending !== null) return;
    setPending(!shown);
    await onChange(!shown);
    setPending(null);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={toggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${shown ? "bg-mint-deep" : "bg-ink/25"}`}
    >
      <span aria-hidden="true" className={`absolute size-5 rounded-full bg-white shadow transition-transform duration-200 ${shown ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
    </button>
  );
}

/**
 * The chosen narrator as plain facts, plus what they still need before their audiobook can be
 * prepared and heard, each done in place: the owner's share (only the owner can give it, so only
 * your own voice gets a button), a narrator slot (within the family's slots), and which children
 * may listen.
 */
function NarratorDetails({
  view,
  voice: v,
  busy,
  showSetup,
  onEdit,
  onDone,
  onShare,
  onSlot,
  onApprove,
}: {
  view: PrepareBookView;
  voice: PrepareVoiceView;
  busy: boolean;
  showSetup: boolean;
  onEdit: () => void;
  /** Closes the setup again once it is complete; null while a step is still open. */
  onDone: (() => void) | null;
  onShare: () => void;
  onSlot: () => void;
  onApprove: (kid: PrepareVoiceView["kids"][number], approved: boolean) => Promise<boolean>;
}) {
  const status = !v.shared ? "Not shared with your family yet" : !v.inSlot ? "Not in a narrator slot yet" : "Active for your family";
  const readyChapters = v.chapters.filter((c) => c.readiness === "ready").length;
  const prepared = v.chapters.length > 1 ? `${readyChapters} of ${v.chapters.length} chapters` : v.readinessLabel;
  const check = (
    <svg aria-hidden="true" className="size-5 shrink-0 text-mint-deep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
  const open = (
    <svg aria-hidden="true" className="size-5 shrink-0 text-ink/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
  const done = (text: string) => (
    <li className="flex items-center gap-3 py-3">
      {check}
      <span className="flex-1">{text}</span>
    </li>
  );
  const todo = (text: string, action: React.ReactNode, note?: string) => (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {open}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{text}</span>
        {note && <span className="text-sm text-muted">{note}</span>}
      </span>
      {action}
    </li>
  );

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <div className="flex items-start gap-4">
        <StorytellerAvatar name={v.name} avatarUrl={v.avatarUrl} tint={v.tint} size="sm" />
        <dl className="grid flex-1 grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-1.5">
          <dt className="text-muted">Narrator</dt>
          <dd className="font-semibold">
            {v.name}
            {v.yours ? " (your voice)" : ""}
          </dd>
          <dt className="text-muted">Status</dt>
          <dd>{status}</dd>
          <dt className="text-muted">Approved for</dt>
          <dd>
            {v.approvedFor.length ? v.approvedFor.join(", ") : "No one yet"}
            {!showSetup && v.kids.length > 0 && (
              <>
                {" · "}
                <button type="button" className="font-semibold underline underline-offset-4" onClick={onEdit}>
                  Change
                </button>
              </>
            )}
            {onDone && (
              <>
                {" · "}
                <button type="button" className="font-semibold underline underline-offset-4" onClick={onDone} data-testid="setup-done">
                  Done
                </button>
              </>
            )}
          </dd>
          <dt className="text-muted">Prepared</dt>
          <dd>{prepared}</dd>
        </dl>
      </div>

      {showSetup && v.unavailableReason !== "Needs Readli Family" && (
        <ol className="divide-y divide-ink/10 border-t border-ink/10" aria-label={`Getting ${v.name} ready`} data-testid="setup">
          {v.shared
            ? done(v.yours ? "Your voice is shared with this family" : "Shared with your family")
            : v.yours
              ? todo(
                  "Share your voice with this family",
                  <button type="button" className={btnPrimary} disabled={busy} onClick={onShare}>
                    Share my voice
                  </button>,
                )
              : todo(`Waiting for ${v.name} to share their voice`, null, "Only they can share it.")}
          {v.inSlot
            ? done("In a narrator slot")
            : view.freeSlots > 0
              ? todo(
                  "Activate as a family narrator",
                  <button type="button" className={btnPrimary} disabled={busy || !v.shared} onClick={onSlot}>
                    Use a narrator slot
                  </button>,
                  `Not in a narrator slot yet. ${view.freeSlots} free.`,
                )
              : todo(
                  "Activate as a family narrator",
                  <Link href="/family/narrators" className={btnSecondary}>
                    Free up a slot
                  </Link>,
                  "Not in a narrator slot, and all your slots are in use.",
                )}
          {v.kids.length === 0 ? (
            todo(
              "Add a child to choose who can listen",
              <Link href="/family/kids" className={btnSecondary}>
                Add a child
              </Link>,
            )
          ) : (
            <li className="flex items-start gap-3 py-3">
              {v.approvedFor.length ? check : open}
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex flex-col">
                  <span className={v.approvedFor.length ? "" : "font-semibold"}>Who can listen</span>
                  {!v.inSlot && <span className="text-sm text-muted">Available after the narrator slot.</span>}
                </span>
                <ul className="flex flex-col gap-2">
                  {v.kids.map((k) => (
                    <li key={k.id} className="flex items-center gap-3">
                      <Switch checked={k.approved} busy={busy} disabled={!v.inSlot} label={`${v.name} for ${k.name}`} onChange={(next) => onApprove(k, next)} />
                      <span>{k.name}</span>
                    </li>
                  ))}
                </ul>
              </span>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

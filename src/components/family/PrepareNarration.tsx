"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import type { GenerationQuote, PrepareBookView, PrepareVoiceView } from "@/lib/narration/narration";
import { StorytellerAvatar } from "./StorytellerAvatar";

const minutes = (seconds: number) => (seconds < 60 ? `${seconds} sec` : `${Math.round((seconds / 60) * 10) / 10} min`);

const BADGE: Record<string, string> = {
  ready: "bg-mint",
  preparing: "bg-sky/60",
  partial: "bg-sunshine",
  not_prepared: "bg-ink/10",
};

/** Readli Family → book → Prepare Narration (Narration Libraries amendment §2). */
export function PrepareNarration({ initial }: { initial: PrepareBookView }) {
  const [view, setView] = useState(initial);
  const [pending, setPending] = useState<{ voice: PrepareVoiceView; quote: GenerationQuote } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const url = `/api/family/books/${view.book.slug}/narration`;
  const preparing = view.voices.some((v) => v.status.readiness === "preparing");

  const reload = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) setView((await res.json()) as PrepareBookView);
  }, [url]);

  // Progress updates while anything is preparing.
  useEffect(() => {
    if (!preparing) return;
    const id = window.setInterval(reload, 1500);
    return () => window.clearInterval(id);
  }, [preparing, reload]);

  const call = async (init: RequestInit, target = url) => {
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
  };

  const estimate = async (voice: PrepareVoiceView) => {
    const body = await call({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ voiceId: voice.voiceId, scope: "book" }) });
    if (body) setPending({ voice, quote: body.quote as GenerationQuote });
  };

  const confirm = async () => {
    if (!pending) return;
    const body = await call({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voiceId: pending.voice.voiceId, scope: "book", confirm: true }),
    });
    if (body) {
      setView(body.view as PrepareBookView);
      setMessage(`Preparing ${view.book.title} in ${pending.voice.name}'s voice. We'll let you know when it's ready.`);
    }
    setPending(null);
  };

  const cancel = async (voice: PrepareVoiceView) => {
    if (!voice.jobId) return;
    const body = await call({ method: "DELETE" }, `${url}?jobId=${voice.jobId}`);
    if (body) {
      setView(body as PrepareBookView);
      setMessage("Stopped. Anything already prepared stays, and unused minutes were returned.");
    }
  };

  return (
    <div className="flex flex-col gap-8" data-testid="prepare-narration">
      <div className="flex flex-col gap-3">
        <p className="font-display font-semibold text-coral-deep">Prepare narration</p>
        <h1 className="font-display text-4xl font-semibold">{view.book.title}</h1>
        <p className="max-w-2xl text-lg">
          Prepare a reading ahead of time so your kids can switch to that storyteller instantly. Listening again never uses
          minutes; only new narration does.
        </p>
      </div>

      <section className="flex flex-col gap-2 rounded-panel bg-sky/30 p-5 sm:flex-row sm:items-center sm:gap-4" aria-label="Narration minutes" data-testid="credits">
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-semibold">{minutes(view.credits.available)} of new narration left</p>
          <p className="text-sm text-muted">
            {minutes(view.credits.monthlyLeft)} left from this month&apos;s {minutes(view.credits.allowanceSeconds)}
            {view.credits.purchasedLeft > 0 ? `, plus ${minutes(view.credits.purchasedLeft)} you bought` : ""}.
            {view.credits.heldSeconds > 0 ? ` ${minutes(view.credits.heldSeconds)} is set aside for narration being prepared.` : ""}
          </p>
        </div>
        {!view.purchasesEnabled && <p className="text-sm font-semibold sm:max-w-56">Buying extra minutes isn&apos;t switched on yet.</p>}
      </section>

      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>

      <ul className="flex flex-col gap-4">
        {view.voices.map((v) => {
          const pct = Math.round((v.status.ready / v.status.total) * 100);
          return (
            <li key={v.voiceId} data-testid={`prepare-${v.voiceId}`} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
              <div className="flex flex-wrap items-center gap-4">
                <StorytellerAvatar name={v.name} avatarUrl={v.avatarUrl} tint={v.tint} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-semibold">{v.name}</p>
                  <ul className="mt-1 flex flex-wrap gap-2 text-xs font-bold" aria-label="Permissions">
                    <li className="rounded-full bg-mint px-2 py-0.5">Shared with your family</li>
                    <li className={`rounded-full px-2 py-0.5 ${v.inSlot ? "bg-mint" : "bg-ink/10"}`}>{v.inSlot ? "In a narrator slot" : "Not in a narrator slot"}</li>
                    <li className={`rounded-full px-2 py-0.5 ${v.approvedFor.length ? "bg-mint" : "bg-ink/10"}`}>
                      {v.approvedFor.length ? `Approved for ${v.approvedFor.join(" and ")}` : "Not approved for any child yet"}
                    </li>
                  </ul>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${BADGE[v.status.readiness]}`} data-testid="readiness">
                  {v.readinessLabel}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="h-3 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${v.name}: ${pct}% prepared`}>
                  <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-sm text-muted">
                  {v.status.ready} of {v.status.total} sentences prepared
                  {v.status.inProgress ? `, ${v.status.inProgress} being prepared` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!v.inSlot ? (
                  <Link href="/family/narrators" className="font-semibold underline underline-offset-4">
                    Add to a narrator slot to prepare
                  </Link>
                ) : v.status.readiness === "preparing" ? (
                  v.jobId && (
                    <button type="button" className={buttonSecondary} disabled={busy} onClick={() => cancel(v)}>
                      Stop preparing
                    </button>
                  )
                ) : v.status.readiness !== "ready" ? (
                  <button type="button" className={buttonPrimary} disabled={busy} onClick={() => estimate(v)}>
                    Prepare {v.status.ready ? "the rest" : "this book"} · about {minutes(v.estimateSeconds)}
                  </button>
                ) : null}
              </div>
              {pending?.voice.voiceId === v.voiceId && (
                <div className="flex flex-col gap-3 rounded-3xl bg-ivory p-4" data-testid="confirm-generation">
                  <p className="font-display text-lg font-semibold">
                    Use about {minutes(pending.quote.estimateSeconds)} of your {minutes(view.credits.available)}?
                  </p>
                  <p className="text-sm text-muted">
                    {pending.quote.sentenceIds.length} new sentences.
                    {pending.quote.reusedReady ? ` ${pending.quote.reusedReady} already prepared are free.` : ""}
                    {pending.quote.alreadyQueued ? ` ${pending.quote.alreadyQueued} are already being prepared, at no cost to you.` : ""} You&apos;re
                    never charged more than this estimate; unused minutes come back.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={buttonPrimary} disabled={busy || pending.quote.estimateSeconds > view.credits.available} onClick={confirm}>
                      Prepare now
                    </button>
                    <button type="button" className={buttonSecondary} onClick={() => setPending(null)}>
                      Not now
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {view.voices.length === 0 && <p className="rounded-3xl bg-surface p-4">No storytellers have shared their voice with your family yet.</p>}
    </div>
  );
}

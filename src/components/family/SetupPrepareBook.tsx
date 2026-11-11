"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { parentPrimary, parentSecondary } from "@/components/brand/buttons";
import { displayCredits } from "@/lib/narration/credits";
import type { GenerationQuote, PrepareBookView } from "@/lib/narration/narration";

/**
 * Setup's Book step: the one intro book, prepared right here in the parent's own voice. One tap shows the cost
 * on the button (or that it's on us, for a new family) and prepares it; a progress bar shows it being made,
 * then the step's Next goes on to Listen. Never leaves setup.
 */
export function SetupPrepareBook({ initial, voiceId, onUs = false }: { initial: PrepareBookView; voiceId: string; /** A new family's first book: free. */ onUs?: boolean }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const url = `/api/family/books/${view.book.slug}/narration`;
  const v = view.voices.find((x) => x.voiceId === voiceId) ?? null;
  const preparing = Boolean(v && (v.status.readiness === "preparing" || v.jobId !== null));
  const ready = v?.availability === "ready";
  // From the tap on, so there's something to watch while the request starts the work.
  const working = !ready && (busy || preparing);
  const pct = v && v.status.total > 0 ? Math.round((v.status.ready / v.status.total) * 100) : 0;

  const reload = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) setView((await res.json()) as PrepareBookView);
  }, [url]);

  useEffect(() => {
    if (!working) return;
    const id = window.setInterval(reload, 1500);
    return () => window.clearInterval(id);
  }, [working, reload]);

  useEffect(() => {
    if (ready) router.refresh();
  }, [ready, router]);

  const post = async (body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(json?.error?.message ?? "We couldn't prepare it just now. Please try again.");
      return null;
    }
    return json;
  };

  const prepare = async () => {
    setBusy(true);
    setMessage(null);
    const target = { voiceId, scope: "book" as const, welcome: onUs };
    // The button already shows the cost, so the quote and the go-ahead happen in one tap.
    const quoted = (await post(target)) as { quote: GenerationQuote } | null;
    const done = quoted ? ((await post({ ...target, confirm: true })) as { view: PrepareBookView } | null) : null;
    if (done) setView(done.view);
    setBusy(false);
  };

  const cost = v ? displayCredits(v.missingCredits, view.credits.unitsPerCredit) : 1;

  return (
    <div className="flex flex-wrap items-center gap-5 rounded-3xl bg-surface p-5 ring-2 ring-ink/10" data-testid="setup-prepare">
      <span className="block w-28 shrink-0 overflow-hidden rounded-xl bg-bookcase shadow-[0_3px_0_rgba(40,53,72,0.12)]">
        {view.book.coverUrl ? (
          <Image src={view.book.coverUrl} alt="" width={160} height={213} className="aspect-[3/4] w-full object-cover" />
        ) : (
          <span className={`flex aspect-[3/4] w-full items-center justify-center p-2 text-center font-display text-sm font-semibold ${view.book.tint}`}>{view.book.title}</span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <p className="font-display text-2xl font-semibold">{view.book.title}</p>
        <p className="text-muted">
          {view.book.author} · about {view.book.minutes} {view.book.minutes === 1 ? "minute" : "minutes"}
          {v ? ` · read by ${v.yours ? "you" : v.name}` : ""}
        </p>
        {!v ? (
          <p>Your voice isn&apos;t ready to read yet. It usually takes a few minutes after recording.</p>
        ) : ready ? (
          <p className="font-semibold" data-testid="setup-book-ready">
            Ready! It&apos;s on your kids&apos; bookshelves now. Tap Next to listen to it.
          </p>
        ) : working ? (
          <div className="flex w-full flex-col gap-2" data-testid="setup-book-preparing">
            <p role="status" className="font-semibold">
              Preparing it in your voice now. This usually takes a minute or two, and you can stay right here.
            </p>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-ink/10"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${pct}% prepared`}
            >
              <div className={`h-full rounded-full bg-ink transition-[width] duration-500 ${pct === 0 ? "w-1/12 animate-pulse" : ""}`} style={pct ? { width: `${pct}%` } : undefined} />
            </div>
            <p className="text-sm text-muted">{v.status.ready > 0 ? `${v.status.ready} of ${v.status.total} sentences prepared` : "Getting started…"}</p>
          </div>
        ) : v.availability === "needs_credits" && !onUs ? (
          <>
            <p>You need {displayCredits(v.extraCreditsNeeded, view.credits.unitsPerCredit)} more credits to prepare it.</p>
            <Link href="/family/settings/plan" className={parentSecondary}>
              Get credits
            </Link>
          </>
        ) : v.availability === "unavailable" ? (
          <p>{v.unavailableReason ?? "This voice can't read it yet."}</p>
        ) : (
          <button type="button" className={parentPrimary} disabled={busy} onClick={() => void prepare()} data-testid="setup-prepare-book">
            {onUs ? "Prepare it free" : `Prepare it · ${cost} ${cost === 1 ? "credit" : "credits"}`}
          </button>
        )}
        {message && (
          <p role="alert" className="text-sm font-semibold text-coral-deep">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

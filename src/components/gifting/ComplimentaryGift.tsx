"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary } from "@/components/brand/buttons";
import { GiftBoxArt } from "@/components/invites/illustrations";
import { normalizeGiftCode } from "@/lib/gifting/codes";
import { claimByLabel, complimentaryHeadline, presentedLine, recipientLine, termPhrase } from "@/lib/gifting/complimentary-copy";
import type { ComplimentaryLanding } from "@/lib/gifting/server";
import type { GiftViewer } from "@/lib/gifting/viewer";

/** Where a scanned code waits while the winner signs in (a magic link may open in a new tab). */
const STASH = "readli-claim-code";
const STASH_MS = 7 * 86_400_000;

function stash(code: string) {
  try {
    localStorage.setItem(STASH, JSON.stringify({ code, at: Date.now() }));
  } catch {
    /* Storage blocked: they can type the code from the certificate. */
  }
}

function stashed(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(STASH) ?? "null") as { code?: string; at?: number } | null;
    if (v?.code && v.at && Date.now() - v.at < STASH_MS) return normalizeGiftCode(v.code);
  } catch {
    /* Nothing usable stored. */
  }
  return null;
}

function forget() {
  try {
    localStorage.removeItem(STASH);
  } catch {
    /* Nothing to clear. */
  }
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const BENEFITS = ["The whole storybook library", "Invite 2 storytellers to read in their own voices", "40 narration credits every month", "Up to 6 kids' profiles you manage"];

function Check() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 shrink-0">
      <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-mint-deep" />
    </svg>
  );
}

/** The typed-code screen's words. /redeem (Readli Gives Back) uses the spec's wording. */
export interface ClaimIntro {
  title: string;
  body: string;
  label: string;
  button: string;
}

const CLAIM_INTRO: ClaimIntro = {
  title: "Claim your Readli gift",
  body: "Type the code printed under the QR code on your certificate.",
  label: "Gift code",
  button: "Find my gift",
};

/**
 * /claim and /redeem: the code arrives after # (from the QR code) or is typed in, waits in this
 * browser while the winner signs in, and is looked up without ever going into a URL the server sees.
 */
export function ClaimFromLink({ path = "/claim", intro = CLAIM_INTRO }: { path?: "/claim" | "/redeem"; intro?: ClaimIntro }) {
  const [code, setCode] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ gift: ComplimentaryLanding; viewer: GiftViewer } | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  async function lookUp(c: string) {
    setChecking(true);
    setError("");
    const res = await fetch("/api/gifts/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: c }) });
    const body = await res.json().catch(() => null);
    setChecking(false);
    if (!res.ok) {
      setError(body?.error?.message ?? "We couldn't open that gift. Please try again.");
      return;
    }
    if (body.kind === "gift") {
      window.location.replace(`/gift/open?code=${encodeURIComponent(c)}`);
      return;
    }
    setCode(c);
    stash(c);
    setLoaded({ gift: body.gift, viewer: body.viewer });
  }

  useEffect(() => {
    const fromHash = normalizeGiftCode(decodeURIComponent(window.location.hash.replace(/^#/, "")));
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    const c = fromHash ?? stashed();
    if (c) void lookUp(c);
    else setChecking(false);
  }, []);

  if (loaded && code) return <ComplimentaryGift code={code} gift={loaded.gift} viewer={loaded.viewer} path={path} />;
  if (checking) {
    return (
      <p aria-live="polite" className="py-16 text-center text-lg">
        Opening your gift…
      </p>
    );
  }
  return <EnterCode error={error} onCode={lookUp} intro={intro} />;
}

function EnterCode({ error, onCode, intro }: { error: string; onCode: (code: string) => void; intro: ClaimIntro }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState("");
  const shown = problem || error;
  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <GiftBoxArt className="w-28" />
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">{intro.title}</h1>
      <p className="max-w-md text-lg">{intro.body}</p>
      <form
        className="flex w-full max-w-md flex-col gap-3"
        aria-label="Claim a gift code"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const c = normalizeGiftCode(value);
          if (!c) return setProblem("That doesn't look like a gift code. It's 12 letters and numbers, like ABCD-EFGH-JKMN.");
          setProblem("");
          onCode(c);
        }}
      >
        <label htmlFor={`${id}-code`} className="font-display text-lg font-semibold">
          {intro.label}
        </label>
        <input
          id={`${id}-code`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ABCD-EFGH-JKMN"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? `${id}-err` : undefined}
          className="min-h-14 rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-center font-display text-2xl tracking-widest focus:border-ink"
        />
        {shown && (
          <p id={`${id}-err`} role="alert" className="font-semibold text-coral-deep">
            {shown}
          </p>
        )}
        <button type="submit" className={buttonPrimary}>
          {intro.button}
        </button>
      </form>
    </section>
  );
}

/** The winner's page (approved mockup, 2026-10-22): short, one clear action, no card, nothing renews. */
export function ComplimentaryGift({ code, gift, viewer, path = "/claim" }: { code: string; gift: ComplimentaryLanding; viewer: GiftViewer; path?: "/claim" | "/redeem" }) {
  const id = useId();
  const [stage, setStage] = useState<"open" | "claimed">(gift.status === "redeemed" ? "claimed" : "open");
  const [familyName, setFamilyName] = useState("");
  const [agreePause, setAgreePause] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ paidThrough: string; billingPaused?: boolean } | null>(null);
  const term = termPhrase(gift.months);
  const greeting = recipientLine(gift.recipientName);
  const claimBy = claimByLabel(gift.claimBy);
  const subscriber = viewer.plan === "subscription";

  async function claim() {
    if (!viewer.signedIn) {
      stash(code);
      window.location.assign(`/login?next=${path}`);
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/gifts/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, familyName: viewer.hasFamily ? undefined : familyName, pauseBilling: subscriber ? agreePause : undefined }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(body?.error?.message ?? "That didn't work. Please try again.");
    forget();
    setResult(body);
    setStage("claimed");
  }

  if (gift.status === "unavailable") {
    return (
      <section role="alert" className="flex flex-col items-center gap-3 rounded-[var(--radius-panel)] bg-coral/20 px-6 py-10 text-center">
        <GiftBoxArt className="w-24" />
        <h1 className="font-display text-3xl font-semibold">This gift can&apos;t be claimed</h1>
        <p className="max-w-md">It may have been withdrawn or passed its claim-by date. If you think that&apos;s a mistake, contact us at hello@readli.ai.</p>
      </section>
    );
  }

  if (stage === "claimed") {
    return (
      <section aria-live="polite" className="flex flex-col items-center gap-4 rounded-[var(--radius-panel)] bg-mint/50 px-6 py-10 text-center">
        <ReadiMascot size={120} decorative />
        <h1 className="font-display text-3xl font-semibold">{result ? "Your gift is claimed" : "This gift has been claimed"}</h1>
        <p className="max-w-md" data-testid="gift-claimed">
          {!result
            ? "If it was you, it's already on your family's account."
            : result.billingPaused
              ? `Your paid plan won't bill again until ${longDate(result.paidThrough)}. After that it carries on as before, unless you cancel first.`
              : `Readli Family is on for your family until ${longDate(result.paidThrough)}. No card needed, and nothing renews on its own.`}
        </p>
        <Link href="/family" className={buttonPrimary}>
          {result ? "Set up my family" : "Go to my family"}
        </Link>
      </section>
    );
  }

  const canClaim = !busy && (!subscriber || (agreePause && viewer.pause !== null));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 sm:gap-7" data-testid="complimentary-gift">
      <section className="flex flex-col items-center gap-3 rounded-[var(--radius-panel)] bg-sky/50 px-5 py-8 text-center sm:flex-row sm:gap-10 sm:px-12 sm:py-11 sm:text-left">
        <GiftBoxArt className="w-24 shrink-0 sm:w-36" />
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold uppercase tracking-[0.08em]">{greeting ?? "Readli gift"}</p>
          <h1 className="font-display text-[2rem] font-semibold leading-tight sm:text-5xl">{complimentaryHeadline(gift)}</h1>
          <p className="text-lg sm:text-xl">{presentedLine(gift)}</p>
        </div>
      </section>

      <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
        <section aria-labelledby={`${id}-plan`} className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10 sm:p-7">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={`${id}-plan`} className="font-display text-2xl font-semibold">
              Readli Family
            </h2>
            <span className="font-bold">{gift.months === 1 ? "1 month" : `${gift.months} months`}</span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {BENEFITS.map((b) => (
              <li key={b} className="flex gap-2.5">
                <Check />
                {b}
              </li>
            ))}
          </ul>
          {gift.message && (
            <figure className="mt-1 flex flex-col gap-1 border-t-2 border-ink/10 pt-3">
              <blockquote className="text-lg">&ldquo;{gift.message}&rdquo;</blockquote>
              <figcaption className="text-sm text-muted">A note from {gift.sponsorName}</figcaption>
            </figure>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section aria-label="What it costs" className="flex flex-col gap-1.5 rounded-[var(--radius-panel)] bg-mint/45 px-5 py-5 sm:px-7">
            <p className="font-display text-xl font-semibold">Free. Really.</p>
            <p>No credit card required.</p>
            <p>No automatic renewal.</p>
            <p>Nothing is charged when it ends. You&apos;d only pay if you later choose a plan at a separate checkout.</p>
          </section>

          {viewer.signedIn && !viewer.hasFamily && (
            <label className="flex flex-col gap-1">
              <span className="font-display font-semibold">Your family&apos;s name (optional)</span>
              <input
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                maxLength={120}
                placeholder="The Garcia family"
                className="min-h-12 rounded-2xl bg-surface px-4 ring-2 ring-ink/20 focus:ring-ink"
              />
            </label>
          )}

          {subscriber && (
            <section className="flex flex-col gap-2 rounded-2xl bg-sunshine/40 p-4" data-testid="subscriber-pause">
              <p className="font-semibold">You already pay for Readli Family.</p>
              {viewer.pause ? (
                <>
                  <p>
                    Claiming pauses your billing: you won&apos;t be charged from {longDate(viewer.pause.from)} until {longDate(viewer.pause.until)}. You keep everything you&apos;ve
                    paid for, and your plan carries on as before after that, unless you cancel first.
                  </p>
                  <label className="flex min-h-11 items-center gap-3 font-semibold">
                    <input type="checkbox" checked={agreePause} onChange={(e) => setAgreePause(e.target.checked)} className="size-5" />
                    Pause my billing for {term}
                  </label>
                </>
              ) : (
                <p>We can&apos;t check your billing right now, so we won&apos;t change anything. Please try again in a little while.</p>
              )}
            </section>
          )}
          {viewer.plan === "subscription_ending" && <p className="text-sm">Your gift starts when your current paid plan ends, so you don&apos;t lose any paid time.</p>}
          {viewer.plan === "membership" && <p className="text-sm">Your gift starts when your current membership ends, so nothing overlaps.</p>}

          {error && (
            <p role="alert" className="rounded-2xl bg-coral/30 p-3 font-semibold">
              {error}
            </p>
          )}
          <button type="button" className={`${buttonPrimary} min-h-14 w-full text-xl`} onClick={claim} disabled={!canClaim}>
            {busy ? "Claiming…" : "Claim My Gift"}
          </button>
          <p className="text-center text-sm text-muted">
            {viewer.signedIn ? "It goes on your own family's account." : "Next, sign in or create a free account and tell us your family's name."}
            {claimBy ? ` Claim by ${claimBy}.` : ""}
          </p>

          <details className="rounded-2xl bg-ink/5 px-5 py-4">
            <summary className="cursor-pointer font-bold">How your privacy works</summary>
            <p className="mt-2 text-[15px]">
              Your family, kids&apos; profiles and storytellers are yours alone. Whoever gave you this gift can see only whether it was claimed, never your family,
              children or voices. No one else&apos;s voice comes with it.
            </p>
          </details>
          {!subscriber && (
            <details className="rounded-2xl bg-ink/5 px-5 py-4">
              <summary className="cursor-pointer font-bold">Already have Readli?</summary>
              <p className="mt-2 text-[15px]">You can still claim it. Before anything changes, we&apos;ll show you exactly how this {term} fits with your current plan.</p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useId, useState } from "react";
import { CODE_LENGTH, CodeBoxes } from "@/components/auth/CodeBoxes";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { trackMetaCustom } from "@/lib/marketing/meta-pixel";

const field = "min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink";

function client() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/**
 * A code typed on this page, or Google. New grown-ups get an account the first time they sign in.
 * The email carries a 6-digit code to type here, so nobody leaves the page, and a link as a fallback
 * (it opens /auth/callback). After the code checks out, /auth/finish does what that callback does,
 * then the page goes on to `next` itself, unless the page passes onSignedIn to carry on in place.
 * Pass onSentChange when the page owns the heading: it then shows "Check your email" itself and the card drops its title.
 * Signup pages pass askMarketing for an unticked opt-in to Bedtime Thursdays and news (below both ways to
 * sign in, saved after sign-in), and signup, which tells the Meta Pixel a sign-up started when the code
 * is sent or Google opens (the confirmed account is the server's CompleteRegistration). Names are asked for after sign-in, where they can't hold anything up.
 */
export function LoginForm({
  next,
  onSentChange,
  askMarketing = false,
  signup,
  submitLabel = "Email me a code",
  onSignedIn,
}: {
  next: string;
  onSentChange?: (sent: boolean) => void;
  askMarketing?: boolean;
  signup?: "Readli Family" | "Readli Voice";
  submitLabel?: string;
  /** Instead of going to `next`: carry on from this page, signed in. Google sign-in still returns to `next`. */
  onSignedIn?: () => Promise<void> | void;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setStateRaw] = useState<"idle" | "sending" | "sent" | "verifying" | "done">("idle");
  const setState = (s: "idle" | "sending" | "sent" | "verifying" | "done") => {
    setStateRaw(s);
    onSentChange?.(s === "sent" || s === "verifying" || s === "done");
  };
  const [error, setError] = useState<string | null>(null);
  const [toGoogle, setToGoogle] = useState(false);
  const [news, setNews] = useState(false);
  const [resent, setResent] = useState(false);
  // Coming back from Google with the Back button restores this page from cache; reset the button.
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setToGoogle(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const callback = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}${askMarketing && news ? "&news=1" : ""}${tz ? `&tz=${encodeURIComponent(tz)}` : ""}`;
  };

  const signedUp = () => {
    if (signup) trackMetaCustom("SignupStarted", { content_name: signup });
  };

  const google = async () => {
    setError(null);
    setToGoogle(true);
    signedUp();
    const { error } = await client().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) {
      setToGoogle(false);
      setError("We couldn't reach Google just now. Please try again.");
    }
    // On success the browser is already on its way to Google; keep showing that it's working.
  };

  const send = async () => {
    const { error } = await client().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback() },
    });
    if (!error) return null;
    return error.status === 429 ? "Too many tries. Please wait a minute and try again." : "We couldn't send the email. Check the address and try again.";
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    const failed = await send();
    if (failed) {
      setState("idle");
      setError(failed);
      return;
    }
    signedUp();
    setCode("");
    setResent(false);
    setState("sent");
  };

  const resend = async () => {
    setError(null);
    const failed = await send();
    if (failed) setError(failed);
    else setResent(true);
  };

  const verify = async (token: string) => {
    if (token.length !== CODE_LENGTH) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setError(null);
    setState("verifying");
    const { error } = await client().auth.verifyOtp({ email: email.trim(), token, type: "email" });
    if (error) {
      setState("sent");
      setCode("");
      setError(error.status === 429 ? "Too many tries. Please wait a minute and try again." : "That code didn't work. Check it, or send a new one.");
      return;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const finished = await fetch("/auth/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ next, news: askMarketing && news, tz }),
    }).catch(() => null);
    const to = finished?.ok ? (((await finished.json().catch(() => ({}))) as { next?: string }).next ?? next) : next;
    setState("done");
    if (onSignedIn) return carryOn();
    window.location.assign(to);
  };

  const carryOn = async () => {
    setError(null);
    try {
      await onSignedIn?.();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "You're signed in, but something went wrong. Please try again.");
    }
  };

  if (state === "sent" || state === "verifying" || state === "done") {
    return (
      <div className="flex w-full flex-col gap-3 rounded-[var(--radius-panel)] bg-mint/50 p-4 text-left sm:p-6" data-testid="code-step">
        {!onSentChange && <p className="font-display text-2xl font-semibold">Check your email</p>}
        <p role="status">
          We sent a 6-digit code to <strong>{email.trim()}</strong>. Enter it here to continue.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
          className="flex flex-col gap-3"
          aria-label="Enter your code"
        >
          <p id={`${id}-code`} className="font-semibold">
            Your 6-digit code
          </p>
          <CodeBoxes value={code} onChange={setCode} onComplete={(c) => void verify(c)} disabled={state !== "sent"} labelledBy={`${id}-code`} />
          <button type="submit" className={`${buttonPrimary} self-start`} disabled={state !== "sent"}>
            {state === "sent" ? "Continue" : "Signing you in…"}
          </button>
        </form>
        {error && (
          <p role="alert" className="font-semibold text-coral-deep">
            {error}
          </p>
        )}
        {state === "done" && error && onSignedIn && (
          <button type="button" className={`${buttonSecondary} self-start`} onClick={() => void carryOn()}>
            Try again
          </button>
        )}
        <p className="text-sm text-muted">No code? Check your spam folder. The email also has a link you can tap instead.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <button type="button" className="font-semibold underline underline-offset-4" disabled={state !== "sent"} onClick={() => void resend()}>
            {resent ? "Sent again" : "Send a new code"}
          </button>
          <button
            type="button"
            className="font-semibold underline underline-offset-4"
            disabled={state !== "sent"}
            onClick={() => {
              setError(null);
              setState("idle");
            }}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <button type="button" onClick={google} disabled={toGoogle} aria-busy={toGoogle} className={`${buttonSecondary} w-full active:bg-ink/10 disabled:opacity-80`}>
        {toGoogle ? (
          <span aria-hidden="true" className="size-5 animate-spin rounded-full border-[3px] border-ink/25 border-t-ink" />
        ) : (
          <span aria-hidden="true" className="font-bold">
            G
          </span>
        )}
        {toGoogle ? "Opening Google…" : "Continue with Google"}
      </button>
      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-ink/15" />
        or with email
        <span className="h-px flex-1 bg-ink/15" />
      </div>
      <form onSubmit={sendCode} className="flex flex-col gap-4" aria-label="Sign in with email">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-email`} className="font-semibold">
            Email
          </label>
          <input id={`${id}-email`} type="email" className={field} autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className={buttonPrimary} disabled={state === "sending" || toGoogle}>
          {state === "sending" ? "Sending…" : submitLabel}
        </button>
      </form>
      {askMarketing && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-ink" checked={news} onChange={(e) => setNews(e.target.checked)} />
          <span>Send me Bedtime Thursdays, a weekly email with two new stories, and occasional Readli news. You can stop any time.</span>
        </label>
      )}
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
      <p className="text-sm text-muted">Readli accounts are for grown-ups 18 and older. Kids use the profiles you set up for them.</p>
    </div>
  );
}

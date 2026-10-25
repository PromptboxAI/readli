"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useId, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { trackMetaCustom } from "@/lib/marketing/meta-pixel";

const field = "min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink";

function client() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/**
 * Email link or Google. New grown-ups get an account the first time they sign in.
 * Pass onSentChange when the page owns the heading: it then shows "Check your email" itself and the card drops its title.
 * Signup pages pass askMarketing for an unticked opt-in to Bedtime Thursdays and news, saved after sign-in,
 * and signup, which tells the Meta Pixel a sign-up started when the link is sent or Google opens (the
 * confirmed account is the server's CompleteRegistration).
 */
export function LoginForm({ next, onSentChange, askMarketing = false, signup }: { next: string; onSentChange?: (sent: boolean) => void; askMarketing?: boolean; signup?: "Readli Family" | "Readli Voice" }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setStateRaw] = useState<"idle" | "sending" | "sent">("idle");
  const setState = (s: "idle" | "sending" | "sent") => {
    setStateRaw(s);
    onSentChange?.(s === "sent");
  };
  const [error, setError] = useState<string | null>(null);
  const [toGoogle, setToGoogle] = useState(false);
  const [news, setNews] = useState(false);
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

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    const { error } = await client().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback() },
    });
    if (error) {
      setState("idle");
      setError(error.status === 429 ? "Too many tries. Please wait a minute and try again." : "We couldn't send the email. Check the address and try again.");
      return;
    }
    signedUp();
    setState("sent");
  };

  if (state === "sent") {
    return (
      <div role="status" className="flex w-full flex-col gap-2 rounded-[var(--radius-panel)] bg-mint/50 p-5 text-left sm:p-6">
        {!onSentChange && <p className="font-display text-2xl font-semibold">Check your email</p>}
        <p>
          We sent a sign-in link to <strong>{email.trim()}</strong>. Open it on any device to continue.
        </p>
        <button type="button" className="self-start font-semibold underline underline-offset-4" onClick={() => setState("idle")}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      {askMarketing && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-ink" checked={news} onChange={(e) => setNews(e.target.checked)} />
          <span>Send me Bedtime Thursdays, a weekly email with two new stories, and occasional Readli news. You can stop any time.</span>
        </label>
      )}
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
      <form onSubmit={sendLink} className="flex flex-col gap-4" aria-label="Sign in with email">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-email`} className="font-semibold">
            Email
          </label>
          <input id={`${id}-email`} type="email" className={field} autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className={buttonPrimary} disabled={state === "sending" || toGoogle}>
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
      <p className="text-sm text-muted">Readli accounts are for grown-ups 18 and older. Kids use the profiles you set up for them.</p>
    </div>
  );
}

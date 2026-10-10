"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useId, useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";

const field = "min-h-12 w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink";

function client() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** Email link or Google. New grown-ups get an account the first time they sign in. */
export function LoginForm({ next }: { next: string }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const google = async () => {
    setError(null);
    const { error } = await client().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) setError("We couldn't reach Google just now. Please try again.");
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    const { error } = await client().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback(), data: name.trim() ? { full_name: name.trim() } : undefined },
    });
    if (error) {
      setState("idle");
      setError(error.status === 429 ? "Too many tries. Please wait a minute and try again." : "We couldn't send the email. Check the address and try again.");
      return;
    }
    setState("sent");
  };

  if (state === "sent") {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-[var(--radius-panel)] bg-mint/50 p-6 text-left">
        <p className="font-display text-2xl font-semibold">Check your email</p>
        <p>
          We sent a sign-in link to <strong>{email.trim()}</strong>. Open it on this device to continue.
        </p>
        <button type="button" className="self-start font-semibold underline underline-offset-4" onClick={() => setState("idle")}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <button
        type="button"
        onClick={google}
        className="flex min-h-12 items-center justify-center gap-3 rounded-full border-[3px] border-ink bg-surface px-6 font-display text-lg font-semibold"
      >
        <span aria-hidden="true" className="font-bold">
          G
        </span>
        Continue with Google
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
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-name`} className="font-semibold">
            Your name <span className="font-normal text-muted">(new to Readli? optional)</span>
          </label>
          <input id={`${id}-name`} className={field} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" className={buttonPrimary} disabled={state === "sending"}>
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

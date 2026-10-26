"use client";

import { useState } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

/** The login page below the mascot: once the code is sent, "Check your email" becomes the page heading. */
export function LoginPanel({ next, linkError }: { next: string; linkError: boolean }) {
  const [sent, setSent] = useState(false);
  return (
    <>
      <h1 className="font-display text-4xl font-semibold">{sent ? "Check your email" : "Log in to Readli"}</h1>
      {!sent && <p className="text-lg">New here? Signing in creates your account.</p>}
      {!sent && linkError && (
        <p role="alert" className="w-full rounded-2xl bg-coral/30 p-3 font-semibold">
          That sign-in link didn&apos;t work or has expired. Please try again.
        </p>
      )}
      <LoginForm next={next} onSentChange={setSent} />
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";

/** A parent adds the inviting storyteller to their Family Circle. Nothing is activated or approved for any child. */
export function ConnectStoryteller({ token, name, familyName }: { token: string; name: string; familyName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "That didn't work. Please try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="flex flex-col items-start gap-4 rounded-[var(--radius-panel)] bg-sky/40 p-6 sm:p-8" data-testid="connect-storyteller">
      <h2 className="font-display text-2xl font-semibold">
        Add {name} to {familyName}
      </h2>
      <p className="max-w-2xl">
        {name} joins your Family Circle as a storyteller waiting for your OK. Nobody hears {name} until you choose a storyteller slot and switch on each child.
      </p>
      <button type="button" className={buttonPrimary} onClick={connect} disabled={busy}>
        {busy ? "Adding…" : `Add ${name} to our Family Circle`}
      </button>
      {error && (
        <p role="alert" className="text-coral-deep">
          {error}
        </p>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";

/** Adds a sponsored gift to the parent's own family, then takes them to their plan. */
export function JoinGiftButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function join() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/sponsorships/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } | undefined;
    if (res?.ok) {
      window.location.assign("/family/billing?gift=joined");
      return;
    }
    setBusy(false);
    if (json?.error?.code === "not_guardian" || res?.status === 403) setError("Set up your family first, then come back to this link.");
    else setError(json?.error?.message ?? "Something went wrong. Please try again.");
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" className={buttonPrimary} disabled={busy} onClick={join}>
        {busy ? "Adding the gift…" : "Accept for your family"}
      </button>
      {error && (
        <p role="alert" className="rounded-2xl bg-coral/20 px-4 py-3 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

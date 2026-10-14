"use client";

import { useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";

/** Sets the family's 4-digit grown-up PIN, used to leave Readli Kids. Shown until a PIN is set. */
export function SetKidsPin() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/family/kids-pin", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
    const json = await res.json().catch(() => null);
    setBusy(false);
    setPin("");
    if (!res.ok) return setMessage(json?.error?.message ?? "We couldn't save that. Please try again.");
    setSaved(true);
  };

  if (saved) {
    return (
      <p role="status" className="rounded-3xl bg-mint/40 p-4 font-semibold" data-testid="set-kids-pin">
        PIN saved. In Kids Mode, tap Grown-ups and enter it to come back here.
      </p>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-3xl bg-sunshine/40 p-4"
      data-testid="set-kids-pin"
      onSubmit={(e) => {
        e.preventDefault();
        if (pin.length === 4) void save();
      }}
    >
      <p className="font-semibold">Set a family PIN so you can leave Kids Mode with it, instead of signing in again.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          New PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-32 rounded-2xl border-2 border-ink/20 bg-ivory px-3 py-2 text-center text-2xl tracking-[0.4em]"
          />
        </label>
        <button type="submit" className={buttonPrimary} disabled={busy || pin.length !== 4}>
          Save PIN
        </button>
      </div>
      {message && (
        <p role="alert" className="text-sm font-semibold text-coral-deep">
          {message}
        </p>
      )}
    </form>
  );
}

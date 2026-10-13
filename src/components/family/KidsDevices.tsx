"use client";

import { useState } from "react";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import type { DeviceView } from "@/lib/family/devices";

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const STATUS: Record<DeviceView["status"], string> = { active: "Active", revoked: "Ended", expired: "Ended after 90 days unused" };

/** Readli Family → Kids devices: set up this device, see and end the others, and set the grown-up PIN. */
export function KidsDevices({ kids, initialDevices, pinSet }: { kids: { id: string; nickname: string }[]; initialDevices: DeviceView[]; pinSet: boolean }) {
  const [devices, setDevices] = useState(initialDevices);
  const [hasPin, setHasPin] = useState(pinSet);
  const [pin, setPin] = useState("");
  const [chosen, setChosen] = useState<string[]>(kids.map((k) => k.id));
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const call = async (url: string, init: RequestInit) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(url, { headers: { "content-type": "application/json" }, ...init });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) setMessage(json?.error?.message ?? "We couldn't save that. Please try again.");
    return res.ok ? json : null;
  };

  const savePin = async () => {
    if (await call("/api/family/kids-pin", { method: "PUT", body: JSON.stringify({ pin }) })) {
      setHasPin(true);
      setPin("");
      setMessage("Grown-up PIN saved.");
    }
  };
  const end = async (d: DeviceView) => {
    if (!window.confirm(`End Readli Kids on ${d.label}? It stops working right away.`)) return;
    if (await call(`/api/family/devices/${d.id}`, { method: "DELETE" })) {
      setDevices((all) => all.map((x) => (x.id === d.id ? { ...x, status: "revoked" } : x)));
      setMessage(`${d.label} can't open Readli Kids any more.`);
    }
  };
  const setUp = async () => {
    if (await call("/api/family/devices", { method: "POST", body: JSON.stringify({ childIds: chosen, label }) })) {
      // A full load that replaces this page, so Back on the kids device never shows a cached parent page.
      window.location.replace("/kids");
    }
  };

  return (
    <div className="flex flex-col gap-8" data-testid="kids-devices">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-semibold">Kids devices</h1>
        <p className="max-w-2xl text-lg">
          Set up an iPad or phone for Readli Kids. The device only gets your kids&apos; bookshelves, never your account. It stays set up
          while it&apos;s used and ends after {90} days unused, or whenever you end it here.
        </p>
      </div>

      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>

      <section aria-labelledby="pin-h" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10">
        <h2 id="pin-h" className="font-display text-2xl font-semibold">
          Grown-up PIN
        </h2>
        <p>
          {hasPin ? "Your family has a PIN. " : "No PIN yet. "}A 4-digit PIN lets a grown-up leave Readli Kids on a device. It doesn&apos;t
          sign you in or unlock billing, voices or sharing; those always need your sign-in.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 font-semibold">
            {hasPin ? "New PIN" : "PIN"}
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              pattern="\d{4}"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-32 rounded-2xl border-2 border-ink/20 bg-ivory px-3 py-2 text-center text-2xl tracking-[0.4em]"
            />
          </label>
          <button type="button" className={buttonPrimary} disabled={busy || pin.length !== 4} onClick={savePin}>
            {hasPin ? "Change PIN" : "Save PIN"}
          </button>
        </div>
      </section>

      <section aria-labelledby="setup-h" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10">
        <h2 id="setup-h" className="font-display text-2xl font-semibold">
          Set up this device
        </h2>
        {kids.length === 0 ? (
          <p>Add a kids profile first.</p>
        ) : (
          <>
            <fieldset className="flex flex-wrap gap-3">
              <legend className="mb-2 font-semibold">Who uses it?</legend>
              {kids.map((k) => (
                <label key={k.id} className="flex items-center gap-2 rounded-full bg-ivory px-4 py-2 font-semibold ring-2 ring-ink/10">
                  <input
                    type="checkbox"
                    checked={chosen.includes(k.id)}
                    onChange={(e) => setChosen((c) => (e.target.checked ? [...c, k.id] : c.filter((x) => x !== k.id)))}
                  />
                  {k.nickname}
                </label>
              ))}
            </fieldset>
            <label className="flex max-w-sm flex-col gap-1 font-semibold">
              Device name
              <input
                value={label}
                maxLength={40}
                placeholder="Family iPad"
                onChange={(e) => setLabel(e.target.value)}
                className="rounded-2xl border-2 border-ink/20 bg-ivory px-3 py-2"
              />
            </label>
            <p className="text-sm text-muted">This signs you out on this device. {hasPin ? "" : "Set a PIN first so a grown-up can leave Readli Kids here."}</p>
            <p className="text-sm text-muted">
              On an iPad or phone, once the bookshelf opens, tap Share and then Add to Home Screen. The Readli Kids shortcut opens straight
              to the bookshelf, and your kids pick who&apos;s listening.
            </p>
            <button type="button" className={`${buttonSecondary} self-start`} disabled={busy || chosen.length === 0} onClick={setUp}>
              Start Readli Kids here
            </button>
          </>
        )}
      </section>

      <section aria-labelledby="devices-h" className="flex flex-col gap-3">
        <h2 id="devices-h" className="font-display text-2xl font-semibold">
          Your kids devices
        </h2>
        {devices.length === 0 ? (
          <p>No devices yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 rounded-3xl bg-surface p-4 ring-2 ring-ink/10" data-testid={`device-${d.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-xl font-semibold">{d.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${d.status === "active" ? "bg-mint" : "bg-ink/10"}`}>{STATUS[d.status]}</span>
                </div>
                <p className="text-sm">For {d.kids.join(", ") || "nobody now"}</p>
                <p className="text-sm text-muted">
                  Set up by {d.registeredBy} on {when(d.createdAt)}. Last used {when(d.lastSeenAt)}.
                </p>
                {d.status === "active" && (
                  <button type="button" className={`${buttonQuiet} self-start px-0`} disabled={busy} onClick={() => end(d)}>
                    End device
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { parentPrimary, buttonQuiet, parentSecondary } from "@/components/brand/buttons";
import { HelpLink } from "@/components/help/HelpLink";
import type { DeviceView } from "@/lib/family/devices";

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const STATUS: Record<DeviceView["status"], string> = { active: "Active", revoked: "Ended", expired: "Ended after 90 days unused" };

/** Readli Family → Kids devices and PIN: the two ways to use Readli Kids, the family PIN, registering this device and ending others. */
export function KidsDevices({
  kids,
  initialDevices,
  pinSet,
  temporaryHours,
  idleDays,
}: {
  kids: { id: string; nickname: string }[];
  initialDevices: DeviceView[];
  pinSet: boolean;
  /** How long Kids Mode on a browser lasts, and how long a registered device may sit unused. */
  temporaryHours: number;
  idleDays: number;
}) {
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
      setMessage("Family PIN saved.");
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
    <div className="flex flex-col gap-5" data-testid="kids-devices">

      <section aria-labelledby="modes-h" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10" data-testid="kids-modes">
        <h2 id="modes-h" className="font-display text-xl font-semibold">
          Two ways to use Readli Kids
        </h2>
        <div className="grid gap-5 md:grid-cols-2">
          {[
            {
              title: "Kids Mode on this browser",
              tag: "Temporary",
              tone: "bg-ink/5",
              lines: [
                "Starts from Open Readli Kids on a child\u2019s card",
                "One child, this browser only",
                "A grown-up leaves it with the family PIN",
                `Ends on its own after ${temporaryHours} hours, and never registers a device`,
              ],
            },
            {
              title: "Registered kids device",
              tag: "Stays set up",
              tone: "bg-mint/50 text-mint-deep",
              lines: [
                "Set up below on the child\u2019s own iPad or phone",
                "Opens only Readli Kids for the kids you choose, never your account",
                "A grown-up leaves it only with the family PIN",
                `Ends after ${idleDays} days unused, or when you end it here`,
              ],
            },
          ].map((m) => (
            <div key={m.title} className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{m.title}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${m.tone}`}>{m.tag}</span>
              </div>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-muted">
                {m.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>

      <section aria-labelledby="pin-h" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10">
        <h2 id="pin-h" className="font-display text-xl font-semibold">
          Family PIN
        </h2>
        <p>
          {hasPin ? "Your family has a PIN. " : "No PIN yet. "}The 4-digit family PIN lets a grown-up leave Readli Kids, on a kids device or in
          Kids Mode on this browser. It never signs you in or unlocks billing, voices or sharing; those always need your sign-in.
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
          <button type="button" className={parentPrimary} disabled={busy || pin.length !== 4} onClick={savePin}>
            {hasPin ? "Change PIN" : "Save PIN"}
          </button>
        </div>
      </section>

      <section aria-labelledby="setup-h" className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-2 ring-ink/10">
        <h2 id="setup-h" className="font-display text-xl font-semibold">
          Register this device for Readli Kids
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
            <p className="text-sm text-muted">
              This device will open only Readli Kids, for the kids you chose, until a grown-up enters the family PIN or you end it here. You
              are signed out on this device only; your other devices stay signed in.{" "}
              {hasPin ? "" : "Set a PIN first so a grown-up can leave Readli Kids here."}
            </p>
            <p className="text-sm text-muted">
              On an iPad or phone, once the bookshelf opens, tap Share and then Add to Home Screen. The Readli Kids shortcut opens straight
              to the bookshelf, and your kids pick who&apos;s listening.{" "}
              <HelpLink slug="readli-kids-on-ipad">iPad steps</HelpLink> · <HelpLink slug="readli-kids-on-android">Android and Fire steps</HelpLink> ·{" "}
              <Link href="/help/print/set-up-readli-kids" target="_blank" className="font-semibold underline underline-offset-4">
                Printable setup guide
              </Link>
            </p>
            <button type="button" className={`${parentSecondary} self-start`} disabled={busy || chosen.length === 0} onClick={setUp}>
              Start Readli Kids here
            </button>
          </>
        )}
      </section>

      <section aria-labelledby="devices-h" className="flex flex-col gap-3">
        <h2 id="devices-h" className="font-display text-xl font-semibold">
          Your kids devices
        </h2>
        {devices.length === 0 ? (
          <p>No devices yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-col gap-1.5 rounded-3xl bg-surface p-4 ring-2 ring-ink/10" data-testid={`device-${d.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-lg font-semibold">{d.label}</p>
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

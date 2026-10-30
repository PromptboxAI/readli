"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { StorytellerAvatar } from "./StorytellerAvatar";

async function pick(childId: string | null) {
  return fetch("/api/kids/device/listener", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ childId }) });
}

/**
 * When the grown-up PIN panel opens, bring it into view and put the cursor in the PIN box. On a phone the
 * panel opens below the fold, so without this a grown-up taps the button and sees nothing happen.
 */
function useRevealPin(open: boolean) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panelRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    inputRef.current?.focus({ preventScroll: true });
  }, [open]);
  return { panelRef, inputRef };
}

/** "Who's listening?" on a kids device. */
export function ListenerPicker({ kids }: { kids: { id: string; nickname: string; tint: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3" data-testid="listener-picker">
      {kids.map((k) => (
        <li key={k.id}>
          <button
            type="button"
            disabled={busy}
            className="flex w-full flex-col items-center gap-3 rounded-3xl bg-surface p-6 ring-2 ring-ink/10 hover:ring-ink"
            onClick={async () => {
              setBusy(true);
              const res = await pick(k.id);
              setBusy(false);
              if (res.ok) router.refresh();
            }}
          >
            <StorytellerAvatar name={k.nickname} avatarUrl={null} tint={k.tint} />
            <span className="font-display text-2xl font-semibold">{k.nickname}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The bottom of a kids screen: switch who's listening, or a grown-up leaves with the PIN. */
export function KidsDeviceFooter({ canSwitch }: { canSwitch: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { panelRef, inputRef } = useRevealPin(open);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const leave = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/kids/device/exit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
    const json = await res.json().catch(() => null);
    setBusy(false);
    setPin("");
    if (!res.ok) return setMessage(json?.error?.message ?? "That didn't work. Please try again.");
    window.location.replace("/login");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4">
        {canSwitch && (
          <button
            type="button"
            className={`${buttonQuiet} px-0 text-sm`}
            onClick={async () => {
              if ((await pick(null)).ok) router.refresh();
            }}
          >
            Switch listener
          </button>
        )}
        <button type="button" className={`${buttonSecondary} min-h-11 px-4 text-sm`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">🔒</span> Grown-ups
        </button>
      </div>
      {open && (
        <div ref={panelRef} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10" data-testid="grown-up-pin">
          <p className="font-semibold">Grown-ups: enter your family PIN to leave Readli Kids on this device. No PIN yet? Sign in instead.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              PIN
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-32 rounded-2xl border-2 border-ink/20 bg-ivory px-3 py-2 text-center text-2xl tracking-[0.4em]"
              />
            </label>
            <button type="button" className={buttonPrimary} disabled={busy || pin.length !== 4} onClick={leave}>
              Leave Readli Kids
            </button>
            <a href="/login" className={buttonSecondary}>
              Sign in instead
            </a>
          </div>
          {message && (
            <p role="alert" className="text-sm font-semibold text-coral-deep">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Temporary Kids Mode on a grown-up's own browser: the grown-up enters the family PIN (checked on the
 * server) and is back in Readli Family, or signs in instead.
 */
export function TemporaryKidsExit({ childName, preview = false }: { childName: string; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const { panelRef, inputRef } = useRevealPin(open);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const leave = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/kids/temporary/exit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
    const json = await res.json().catch(() => null);
    setPin("");
    // Kids Mode already ended on this browser (a grown-up signed in or left it in another tab, or this page
    // was left open): there's nothing to unlock, so go where this browser belongs now.
    if (res.ok || json?.error?.code === "not_temporary") return window.location.replace("/family");
    setBusy(false);
    setMessage(json?.error?.message ?? "That didn't work. Please try again.");
  };

  return (
    <div className="flex flex-col gap-3">
      <button type="button" className={`${buttonSecondary} min-h-11 self-start px-4 text-sm`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">🔒</span> Grown-ups
      </button>
      {open && (
        <div ref={panelRef} className="flex flex-col gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10" data-testid="temporary-kids-exit">
          <p className="font-semibold">This browser is showing only {childName}&apos;s stories. Enter your family PIN to go back to Readli Family.</p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (pin.length === 4 && !busy) void leave();
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Family PIN
              <input
                ref={inputRef}
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
              Back to Readli Family
            </button>
          </form>
          {message && (
            <p role="alert" className="text-sm font-semibold text-coral-deep">
              {message}
            </p>
          )}
          {preview ? (
            <PreviewKidsExit />
          ) : (
            <a href="/login?next=/family" className="self-start text-sm font-semibold underline underline-offset-4">
              Forgot the PIN? Sign in instead
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** The preview's way out of Kids Mode: clears this browser's preview and starts a new one. */
export function PreviewKidsExit() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const leave = async () => {
    setBusy(true);
    const res = await fetch("/api/family/session", { method: "DELETE" });
    if (res.ok) return window.location.replace("/family");
    setBusy(false);
    setMessage(res.status === 403 ? "Use the grown-up PIN to leave Readli Kids on this device." : "That didn't work. Please try again.");
  };
  return (
    <div className="flex flex-col gap-2">
      <button type="button" className={`${buttonPrimary} self-start`} disabled={busy} onClick={leave}>
        Grown-ups: start the preview over
      </button>
      {message && <p role="alert" className="font-semibold">{message}</p>}
    </div>
  );
}

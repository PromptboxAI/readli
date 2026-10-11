"use client";

import { useEffect, useId, useState } from "react";
import { PERMISSION_STATEMENTS, VOICE_AGREEMENT_PATH } from "@/lib/content/voice-agreement";

interface Agreement {
  id: string;
  version: string;
  event: "accepted" | "updated" | "withdrawn";
  rights: { service: boolean; readliDevelopment: boolean; thirdPartyLicensing: boolean };
  agreedAt: string;
}

const licensing = PERMISSION_STATEMENTS.find((p) => p.permission === "third_party_licensing")!;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** What a grown-up's Readli voice may be used for, and the optional licensing switch. Hidden until they've recorded. */
export function VoicePermissions() {
  const id = useId();
  const [history, setHistory] = useState<Agreement[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/voice/agreement", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ history: Agreement[] }>) : null))
      .then((body) => live && setHistory(body?.history ?? []))
      .catch(() => live && setHistory([]));
    return () => {
      live = false;
    };
  }, []);

  const current = history?.[0];
  if (!current) return null;

  const toggle = async (on: boolean) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/voice/agreement", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ thirdPartyLicensing: on }) });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return setError((body?.error?.message as string | undefined) ?? "Something went wrong. Please try again.");
    }
    const { agreement } = (await res.json()) as { agreement: Agreement };
    setHistory((h) => (h && h[0]?.id === agreement.id ? h : [agreement, ...(h ?? [])]));
  };

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="font-display text-2xl font-semibold">
        Voice permissions
      </h2>
      <p>
        Under the <a href={VOICE_AGREEMENT_PATH} className="font-semibold underline underline-offset-4">Voice Recording &amp; AI Training Agreement</a>, Readli
        uses your original recording to make your story voice and to improve Readli&apos;s own voice technology.
      </p>
      <label className="flex items-start gap-3 rounded-2xl bg-ivory p-4">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-coral-deep"
          checked={current.rights.thirdPartyLicensing}
          disabled={busy}
          onChange={(e) => void toggle(e.target.checked)}
        />
        <span className="flex flex-col gap-1">
          <span className="font-semibold">{licensing.title}</span>
          <span className="text-sm">{licensing.statement}</span>
        </span>
      </label>
      {error && (
        <p role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
      <details>
        <summary className="cursor-pointer font-semibold">Your history</summary>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {history.map((a) => (
            <li key={a.id}>
              {when(a.agreedAt)}: {a.event === "accepted" ? "Agreed before recording" : a.event === "withdrawn" ? "Withdrew" : "Changed"}; licensing to other companies{" "}
              {a.rights.thirdPartyLicensing ? "on" : "off"} ({a.version})
            </li>
          ))}
        </ul>
      </details>
      <p className="text-sm text-muted">To stop Readli using your recording altogether, delete your voice or your account below.</p>
    </section>
  );
}

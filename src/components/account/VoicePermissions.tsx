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
  const [deletion, setDeletion] = useState<{ due_at: string; status: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/voice/recordings", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ latest: { due_at: string; status: string } | null }>) : null))
      .then((body) => live && setDeletion(body?.latest ?? null))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

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
  // Nothing to choose until they have an agreement in force (none yet, or they deleted their voice).
  if (!current || !current.rights.service) return null;

  const change = async (body: Record<string, boolean>) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/voice/agreement", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return setError((body?.error?.message as string | undefined) ?? "Something went wrong. Please try again.");
    }
    const { agreement } = (await res.json()) as { agreement: Agreement };
    setHistory((h) => (h && h[0]?.id === agreement.id ? h : [agreement, ...(h ?? [])]));
  };

  const requestDeletion = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/voice/recordings", { method: "POST" });
    setBusy(false);
    setConfirmDelete(false);
    if (!res.ok) return setError("We couldn't send your request. Please try again.");
    const { dueAt } = (await res.json()) as { dueAt: string };
    setDeletion({ due_at: dueAt, status: "pending" });
  };
  const training = current.rights.readliDevelopment || current.rights.thirdPartyLicensing;

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
          disabled={busy || !current.rights.readliDevelopment}
          onChange={(e) => void change({ thirdPartyLicensing: e.target.checked })}
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
      <div className="flex flex-col gap-2 rounded-2xl bg-ivory p-4">
        <h3 className="font-semibold">Your choices are separate</h3>
        <p className="text-sm">
          <span className="font-semibold">Family sharing:</span> turn sharing off for a family on your voice page. That family stops hearing new stories in
          your voice; your recordings aren&apos;t deleted.
        </p>
        <p className="text-sm">
          <span className="font-semibold">AI training:</span>{" "}
          {training ? "you can stop Readli using your recordings to improve its voice technology, and to license them. Your story voice keeps working." : "off. Readli doesn't use your recordings for AI training."}
        </p>
        {training && (
          <button type="button" className="self-start font-semibold underline underline-offset-4" disabled={busy} onClick={() => void change({ aiTraining: false })}>
            Stop using my recordings for AI training
          </button>
        )}
        <p className="text-sm">
          <span className="font-semibold">Delete my recordings:</span>{" "}
          {deletion?.status === "pending"
            ? `requested. We've stopped using them and will delete them from our storage by ${new Date(deletion.due_at).toLocaleDateString(undefined, { dateStyle: "long" })}.`
            : deletion?.status === "completed"
              ? "done. Your original recordings were deleted."
              : "removes your original recordings from Readli's storage, normally within 30 days. Stories already made stay with your families."}
        </p>
        {deletion?.status !== "pending" &&
          (confirmDelete ? (
            <span className="flex flex-wrap gap-3">
              <button type="button" className="font-semibold text-coral-deep underline underline-offset-4" disabled={busy} onClick={() => void requestDeletion()}>
                Yes, delete my recordings
              </button>
              <button type="button" className="underline underline-offset-4" onClick={() => setConfirmDelete(false)}>
                Keep them
              </button>
            </span>
          ) : (
            <button type="button" className="self-start font-semibold underline underline-offset-4" onClick={() => setConfirmDelete(true)}>
              Delete my original recordings
            </button>
          ))}
      </div>
      <p className="text-sm text-muted">To stop your voice being used at all, delete your voice or your account below.</p>
    </section>
  );
}

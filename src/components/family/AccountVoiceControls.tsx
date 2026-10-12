"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";

/** The signed-in grown-up's own recording: hear it, or record it again for better quality. Deleting is paused for now. */
export function AccountVoiceControls({ voice }: { voice: { status: string; version: number; updatedAt: string } | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sample, setSample] = useState<string | null>(null);

  useEffect(() => () => void (sample && URL.revokeObjectURL(sample)), [sample]);

  const playSample = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/voice/sample", { method: "POST" });
    setBusy(false);
    if (!res.ok) return setMessage((await res.json().catch(() => null))?.error?.message ?? "We couldn't play a sample just now.");
    setSample(URL.createObjectURL(await res.blob()));
  };

  return (
    <section aria-labelledby="recording-h" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10" data-testid="account-voice">
      <h2 id="recording-h" className="font-display text-2xl font-semibold">
        Your recording
      </h2>
      {voice ? (
        <>
          <p>
            Recorded {new Date(voice.updatedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            {voice.version > 1 ? ` (take ${voice.version})` : ""}. Recording again in a quiet room replaces it, and families you share it
            with keep hearing you, with the new recording.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonSecondary} disabled={busy || voice.status !== "ready"} onClick={playSample}>
              Hear my voice
            </button>
            <Link href="/voice/record" className={buttonSecondary}>
              Record again
            </Link>
          </div>
          <p className="text-sm text-muted">
            Deleting your voice yourself is paused while we update how finished stories are kept. Email admin@readli.ai if you need it
            deleted now.
          </p>
          {sample && <audio key={sample} controls autoPlay src={sample} className="w-full" aria-label="A sample of your Readli voice" />}
        </>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p>You don&apos;t have a Readli voice right now. Record one in about a minute, whenever you like.</p>
          <Link href="/voice/record" className={buttonPrimary}>
            Record my voice
          </Link>
        </div>
      )}
      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { VOICE_CHOICES } from "@/lib/content/voice-agreement";

/** The signed-in grown-up's own recording: hear it, record it again for better quality, or delete it. */
export function AccountVoiceControls({ voice }: { voice: { status: string; version: number; updatedAt: string } | null }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
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

  const remove = async () => {
    setBusy(true);
    const res = await fetch("/api/voice", { method: "DELETE" });
    setBusy(false);
    setConfirming(false);
    if (!res.ok) return setMessage((await res.json().catch(() => null))?.error?.message ?? "We couldn't delete your voice. Please try again.");
    setSample(null);
    setMessage(
      "Your voice is deleted. Nothing new can be made in it, and your original recordings will be deleted from our storage, normally within 30 days. Stories already prepared in it stay with the families you shared it with.",
    );
    router.refresh();
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
            {voice.version > 1 ? ` (take ${voice.version})` : ""}. Recording again in a quiet room replaces it: new stories use the new
            recording, and stories already prepared keep the one they were made with.
          </p>
          {confirming ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-coral/15 p-4">
              <p className="font-semibold">{VOICE_CHOICES.deleteVoice.title}?</p>
              <p>
                {VOICE_CHOICES.deleteVoice.notice} To have stories already prepared removed too, email admin@readli.ai.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={buttonPrimary} disabled={busy} onClick={remove}>
                  {VOICE_CHOICES.deleteVoice.title}
                </button>
                <button type="button" className={buttonSecondary} disabled={busy} onClick={() => setConfirming(false)}>
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button type="button" className={buttonSecondary} disabled={busy || voice.status !== "ready"} onClick={playSample}>
                Hear my voice
              </button>
              <Link href="/voice/record" className={buttonSecondary}>
                Record again
              </Link>
              <button type="button" className={buttonQuiet} disabled={busy} onClick={() => setConfirming(true)}>
                {VOICE_CHOICES.deleteVoice.title}
              </button>
            </div>
          )}
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

"use client";

import { useEffect, useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";

/** Storyteller setup's last step: the opening of a bedtime story, read in their own voice. */
export function HearMyVoice({ ready }: { ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sample, setSample] = useState<string | null>(null);

  useEffect(() => () => void (sample && URL.revokeObjectURL(sample)), [sample]);

  const play = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/voice/sample", { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setMessage((await res?.json().catch(() => null))?.error?.message ?? "We couldn't play it just now. Please try again.");
    setSample(URL.createObjectURL(await res.blob()));
  };

  return (
    <div className="flex flex-col items-start gap-3" data-testid="hear-my-voice">
      <button type="button" className={buttonPrimary} disabled={!ready || busy} onClick={play}>
        {busy ? "Getting it ready…" : sample ? "Play it again" : "Play my story"}
      </button>
      {sample && <audio key={sample} controls autoPlay src={sample} className="w-full max-w-md" aria-label="A story opening read in your voice" />}
      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>
    </div>
  );
}

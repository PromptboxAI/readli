"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { trackVoiceEvent } from "@/lib/voice/track";

/**
 * Offered when ElevenLabs has a newer reading model than the one this voice uses. The owner hears
 * their voice both ways, free, and switches only if they prefer the new one. Prepared books keep
 * their audio; books prepared from then on use the new model.
 */
export function VoiceModelUpgrade() {
  const router = useRouter();
  const [busy, setBusy] = useState<"current" | "latest" | "switch" | null>(null);
  const [samples, setSamples] = useState<{ current?: string; latest?: string }>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(
    () => () => {
      for (const url of Object.values(samples)) if (url) URL.revokeObjectURL(url);
    },
    [samples],
  );

  const hear = async (which: "current" | "latest") => {
    setBusy(which);
    setMessage(null);
    const res = await fetch(`/api/voice/sample${which === "latest" ? "?latest=1" : ""}`, { method: "POST" });
    setBusy(null);
    if (!res.ok) return setMessage((await res.json().catch(() => null))?.error?.message ?? "We couldn't play a sample just now.");
    if (which === "latest") trackVoiceEvent("model_preview_played", {});
    const url = URL.createObjectURL(await res.blob());
    setSamples((s) => ({ ...s, [which]: url }));
  };

  const switchOver = async () => {
    setBusy("switch");
    const res = await fetch("/api/voice/model", { method: "POST" });
    setBusy(null);
    if (!res.ok) return setMessage((await res.json().catch(() => null))?.error?.message ?? "We couldn't switch your voice. Please try again.");
    setMessage("Done. New stories you prepare will use the new version of your voice.");
    router.refresh();
  };

  return (
    <section aria-labelledby="model-upgrade-h" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-sunshine/40 p-5" data-testid="voice-model-upgrade">
      <h2 id="model-upgrade-h" className="font-display text-2xl font-semibold">
        A new version of your voice is ready to try
      </h2>
      <p className="max-w-2xl">
        Our voice partner released a newer model. Hear the same line both ways. If you like the new one better, switch for free.
        Stories you&apos;ve already prepared stay exactly as they are; new stories use the version you choose.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonSecondary} disabled={busy !== null} onClick={() => hear("current")}>
          {busy === "current" ? "Getting it ready…" : "Hear my voice now"}
        </button>
        <button type="button" className={buttonSecondary} disabled={busy !== null} onClick={() => hear("latest")}>
          {busy === "latest" ? "Getting it ready…" : "Hear the new version"}
        </button>
      </div>
      {samples.current && <audio key={samples.current} controls src={samples.current} className="w-full" aria-label="Your voice now" />}
      {samples.latest && <audio key={samples.latest} controls src={samples.latest} className="w-full" aria-label="Your voice on the new version" />}
      {samples.latest && (
        <button type="button" className={`${buttonPrimary} self-start`} disabled={busy !== null} onClick={switchOver}>
          {busy === "switch" ? "Switching…" : "Switch to the new version"}
        </button>
      )}
      <p role="status" aria-live="polite" className={message ? "font-semibold" : "sr-only"}>
        {message}
      </p>
    </section>
  );
}

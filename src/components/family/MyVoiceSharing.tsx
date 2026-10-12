"use client";

import { useState } from "react";
import { VOICE_CHOICES } from "@/lib/content/voice-agreement";
import type { MyVoiceView } from "@/lib/family/service";
import { Toggle } from "./Toggle";

/** The voice owner's own switch, per family. Turning it off removes the voice from every child at once. */
export function MyVoiceSharing({ initial }: { initial: MyVoiceView[] }) {
  const [voices, setVoices] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = async (voiceId: string, householdId: string, name: string, shared: boolean) => {
    setSaving(true);
    const res = await fetch(`/api/family/voices/${voiceId}/share`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ householdId, shared }),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) return setMessage(body?.error?.message ?? "We couldn't save that. Please try again.");
    setVoices(body.voices);
    setMessage(
      shared
        ? `Your voice is now available to ${name}. Each child's parent still chooses whether their child hears it.`
        : `Your voice is no longer available to ${name}. It was removed from every child's bookshelf.`,
    );
  };

  const [confirmPause, setConfirmPause] = useState<string | null>(null);
  const pause = async (voiceId: string, paused: boolean) => {
    setSaving(true);
    const res = await fetch(`/api/family/voices/${voiceId}/new-stories`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ paused }) });
    const body = await res.json().catch(() => null);
    setSaving(false);
    setConfirmPause(null);
    if (!res.ok) return setMessage(body?.error?.message ?? "We couldn't save that. Please try again.");
    setVoices(body.voices);
    setMessage(
      paused
        ? "New stories in your voice are stopped for every family. Stories already made still play."
        : "Families you share with can have new stories made in your voice again.",
    );
  };

  if (voices.length === 0) return <p className="rounded-3xl bg-surface p-4">You haven&apos;t recorded your voice yet.</p>;
  return (
    <div className="flex flex-col gap-4" data-testid="my-voice">
      <p role="status" aria-live="polite" className={message ? "rounded-2xl bg-ivory p-3 font-semibold ring-2 ring-ink/10" : "sr-only"}>
        {message}
      </p>
      {voices.map((v) =>
        v.status !== "ready" ? (
          <p key={v.voiceId} className="rounded-3xl bg-lavender/40 p-4 font-semibold">
            Your voice is still being made. You can share it once it&apos;s ready.
          </p>
        ) : (
            <div key={v.voiceId} className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {v.households.map((h) => (
                <li key={h.id} className="flex items-center gap-4 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl font-semibold">{h.name}</p>
                    <p className="text-sm text-muted">{h.shared ? "Available to your family" : "Private: only you can use it"}</p>
                  </div>
                  <Toggle checked={h.shared} disabled={saving} label={`Share my voice with ${h.name}`} onChange={(on) => set(v.voiceId, h.id, h.name, on)} />
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 rounded-3xl bg-ivory p-4 ring-2 ring-ink/10" data-testid="stop-sharing">
              <p className="font-semibold">{VOICE_CHOICES.stopSharing.title}</p>
              {v.paused ? (
                <>
                  <p className="text-sm">New stories in your voice are stopped for every family. Stories already made still play.</p>
                  <button type="button" className="self-start font-semibold underline underline-offset-4" disabled={saving} onClick={() => void pause(v.voiceId, false)}>
                    Allow new stories again
                  </button>
                </>
              ) : confirmPause === v.voiceId ? (
                <>
                  <p className="text-sm">{VOICE_CHOICES.stopSharing.notice}</p>
                  <span className="flex flex-wrap gap-3">
                    <button type="button" className="font-semibold text-coral-deep underline underline-offset-4" disabled={saving} onClick={() => void pause(v.voiceId, true)}>
                      Yes, stop new stories everywhere
                    </button>
                    <button type="button" className="underline underline-offset-4" onClick={() => setConfirmPause(null)}>
                      Keep sharing
                    </button>
                  </span>
                </>
              ) : (
                <button type="button" className="self-start font-semibold underline underline-offset-4" disabled={saving} onClick={() => setConfirmPause(v.voiceId)}>
                  Stop new stories in my voice for every family
                </button>
              )}
          </div>
          </div>
        ),
      )}
    </div>
  );
}

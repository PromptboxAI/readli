"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { ImproveLink, RecordingTipsDialog } from "@/components/teleprompter/RecordingTips";
import { TeleprompterRecorder } from "@/components/teleprompter/TeleprompterRecorder";
import type { TakeDetails } from "@/components/teleprompter/VoicePreview";
import { VOICE_CONSENTS } from "@/lib/content/voice-consents";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";

const STEPS = ["Your voice, your rules", "Record", "Check it's you", "Done"] as const;

type Phase = "idle" | "making" | "sampling" | "ready" | "keeping" | "error";

function deviceClass(): "phone" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 640 ? "phone" : w < 1024 ? "tablet" : "desktop";
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

/**
 * Readli Voice for a signed-in grown-up: consent, record with the teleprompter, make the voice,
 * listen to a sample and keep it. The voice is saved privately; sharing happens per family. A new
 * recording stays a candidate until "Keep my voice", so a working voice is never lost to a worse one.
 */
export function AccountVoiceSetup({ hasVoice, next, parent = false }: { hasVoice: boolean; next?: string; parent?: boolean }) {
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState<boolean[]>(VOICE_CONSENTS.map(() => false));
  const [take, setTake] = useState<TakeDetails | null>(null);
  const [cleanUp, setCleanUp] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState<{ url: string; cleanUp: boolean; standIn: boolean } | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [afterFeedback, setAfterFeedback] = useState(false);

  useEffect(() => {
    return () => {
      if (sample) URL.revokeObjectURL(sample.url);
    };
  }, [sample]);

  const takeChosen = (t: TakeDetails) => {
    setTake(t);
    // Clean-up starts on only when the recorder heard a noisy room; quiet takes keep their natural sound.
    setCleanUp(t.recorded.qc.issues.includes("noisy"));
    setSample(null);
    setPhase("idle");
    setError(null);
    setStep(2);
  };

  const makeVoice = async () => {
    if (!take) return;
    setError(null);
    setPhase("making");
    try {
      const form = new FormData();
      form.append("audio", take.recorded.blob, "take");
      form.append("durationMs", String(Math.round(take.recorded.durationMs)));
      form.append("wpm", String(take.wpm));
      form.append("pauseCount", String(take.pauseCount));
      form.append("deviceClass", deviceClass());
      if (take.scriptOffsetEnd !== null) form.append("scriptOffsetEnd", String(take.scriptOffsetEnd));
      for (const c of VOICE_CONSENTS) form.append("consent", c);
      form.append("removeBackgroundNoise", String(cleanUp));
      form.append("afterFeedback", String(afterFeedback));
      for (const issue of take.recorded.qc.issues) form.append("qcIssue", issue);
      const made = await fetch("/api/voice", { method: "POST", body: form });
      if (!made.ok) throw new Error(await errorMessage(made, "We couldn't make your voice just now. Please try again."));

      setPhase("sampling");
      const res = await fetch("/api/voice/sample?candidate=1", { method: "POST" });
      if (!res.ok) throw new Error(await errorMessage(res, "Your voice is saved, but we couldn't play a sample just now."));
      setSample({ url: URL.createObjectURL(await res.blob()), cleanUp, standIn: res.headers.get("x-readli-stand-in") === "1" });
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPhase("error");
    }
  };

  const keepVoice = async () => {
    setError(null);
    setPhase("keeping");
    try {
      const res = await fetch("/api/voice/keep", { method: "POST" });
      if (!res.ok) throw new Error(await errorMessage(res, "We couldn't save your voice just now. Please try again."));
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPhase("ready");
    }
  };

  /** Back to the recorder. A clone that wasn't kept is thrown away; the current voice carries on. */
  const recordAgain = (fromFeedback = false) => {
    if (sample) void fetch("/api/voice/candidate", { method: "DELETE" }).catch(() => undefined);
    if (fromFeedback) setAfterFeedback(true);
    setSample(null);
    setPhase("idle");
    setError(null);
    setStep(1);
  };

  const busy = phase === "making" || phase === "sampling" || phase === "keeping";

  return (
    <div className="flex flex-col gap-6">
      <ol className="grid grid-cols-4 gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className="flex flex-col items-center gap-1 text-center">
            <span className={`grid size-10 place-items-center rounded-full font-display font-semibold ${i < step ? "bg-mint" : i === step ? "bg-coral text-white" : "bg-surface ring-2 ring-ink/15"}`}>
              {i < step ? "✓" : i + 1}
            </span>
            <span className="text-xs font-semibold sm:text-sm">{s}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-lavender/40 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Your voice, your rules</h2>
          {hasVoice && (
            <p>
              You already have a Readli voice. If you record again, your current voice keeps working until you listen to the new one
              and choose to keep it. Families you share with keep hearing you either way.
            </p>
          )}
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Your agreement</legend>
            {VOICE_CONSENTS.map((c, i) => (
              <label key={c} className="flex items-start gap-3 rounded-2xl bg-surface p-4">
                <input
                  type="checkbox"
                  checked={agreed[i]}
                  onChange={(e) => setAgreed(agreed.map((v, j) => (j === i ? e.target.checked : v)))}
                  className="mt-1 size-5 shrink-0 accent-coral-deep"
                />
                <span>{c}</span>
              </label>
            ))}
          </fieldset>
          <button type="button" className={`${buttonPrimary} w-fit`} disabled={!agreed.every(Boolean)} onClick={() => setStep(1)}>
            I agree
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold">Read the story out loud</h2>
          <p>Read the whole story, about one to two minutes. Find a quiet spot and read it in your natural, warm storytime voice. Your Readli voice copies how you read.</p>
          <TeleprompterRecorder script={DEMO_SCRIPT} onTake={takeChosen} takeActionLabel="Use this recording" />
        </section>
      )}

      {step === 2 && take && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sky/40 p-6 sm:p-8" data-testid="account-voice-check">
          <h2 className="font-display text-2xl font-semibold">Does this sound like you?</h2>
          <label className="flex items-start gap-3 rounded-2xl bg-surface p-4">
            <input
              type="checkbox"
              className="mt-1 size-6 shrink-0 accent-coral-deep"
              checked={cleanUp}
              disabled={busy}
              onChange={(e) => setCleanUp(e.target.checked)}
            />
            <span className="flex flex-col gap-1">
              <span className="font-semibold">Clean up background noise</span>
              <span className="text-sm text-muted">
                Helps with echoey or noisy rooms, but it can make a clean recording sound less like you. You can try it both ways.
              </span>
            </span>
          </label>

          {busy && (
            <div role="status" className="flex items-center gap-4 rounded-2xl bg-plum p-4 text-white">
              <ReadiMascot state="listening" size={72} decorative className="animate-bob" />
              <p className="font-display text-lg font-semibold">{phase === "making" ? "Readi is listening to your voice…" : phase === "keeping" ? "Saving your voice…" : "Getting your sample ready…"}</p>
            </div>
          )}

          {sample && !busy && (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
              <p className="font-semibold">A story read by your Readli voice</p>
              <p className="text-sm text-muted">This is new narration made from your recording, not the recording itself.</p>
              <audio key={sample.url} controls autoPlay src={sample.url} className="w-full" aria-label="A sample of your Readli voice" />
              <p className="text-sm text-muted">Noise clean-up {sample.cleanUp ? "on" : "off"}</p>
              {sample.standIn && <p className="text-sm font-semibold">Test mode: this is a stand-in sound, not your voice.</p>}
              <ImproveLink onOpen={() => setTipsOpen(true)} where="account_sample" />
              {hasVoice && <p className="text-sm text-muted">Your current voice stays in use until you keep this one.</p>}
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-2xl border-[3px] border-coral-deep bg-surface p-4 font-semibold">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {phase === "ready" && sample?.cleanUp === cleanUp ? (
              <button type="button" className={buttonPrimary} onClick={() => void keepVoice()}>
                Keep my voice
              </button>
            ) : (
              <button type="button" className={buttonPrimary} disabled={busy} onClick={() => void makeVoice()}>
                {sample ? `Try again with clean-up ${cleanUp ? "on" : "off"}` : "Make my voice"}
              </button>
            )}
            <button type="button" className={buttonSecondary} disabled={busy} onClick={() => recordAgain()}>
              Record again
            </button>
          </div>
          <RecordingTipsDialog open={tipsOpen} onClose={() => setTipsOpen(false)} onRecordAgain={() => recordAgain(true)} where="account_sample" />
        </section>
      )}

      {step === 3 && (
        <section aria-live="polite" className="flex flex-col items-center gap-4 rounded-[var(--radius-panel)] bg-mint/50 p-8 text-center">
          <ReadiMascot size={130} decorative />
          <h2 className="font-display text-3xl font-semibold">Your voice is ready</h2>
          <p className="max-w-md">It&apos;s private. Nobody can use it until you share it with a family, and their parents approve it for each child.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={next ?? "/voice"} className={buttonPrimary}>
              {next ? "Continue" : "Choose who can use it"}
            </Link>
            {parent && !next && (
              <Link href="/family" className={buttonQuiet}>
                Back to my family
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

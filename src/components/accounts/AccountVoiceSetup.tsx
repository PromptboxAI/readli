"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { ImproveLink, RecordingTipsDialog } from "@/components/teleprompter/RecordingTips";
import { TeleprompterRecorder } from "@/components/teleprompter/TeleprompterRecorder";
import type { TakeDetails } from "@/components/teleprompter/VoicePreview";
import { AskName } from "@/components/account/AskName";
import { VOICE_CONSENTS, VOICE_CONSENT_SENTENCE } from "@/lib/content/voice-consents";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";
import { formatClock } from "@/lib/teleprompter/recorder-machine";
import type { GuestTake } from "@/lib/voice/guest-handoff";

type Phase = "idle" | "making" | "sampling" | "ready" | "keeping" | "error";

function deviceClass(): "phone" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 640 ? "phone" : w < 1024 ? "tablet" : "desktop";
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? fallback;
}

class GuestTakeGone extends Error {}

/**
 * Readli Voice for a signed-in grown-up: one consent, then the demo take (preferred, while it lasts)
 * or a new recording, a sample to hear, and keep. A new voice stays a candidate until "Keep This
 * Voice", so a working voice is never lost to a worse one. Once kept, it leads straight to choosing a
 * story to share with family (or back to `next`, when a storyteller invitation sent them here).
 */
export function AccountVoiceSetup({
  hasVoice,
  next,
  parent = false,
  guestTake = null,
  guestCleanUp = false,
  fromTry = false,
  askName = false,
}: {
  hasVoice: boolean;
  next?: string;
  parent?: boolean;
  /** A take this browser recorded on /try that can become the voice without reading again. */
  guestTake?: GuestTake | null;
  /** The noise clean-up setting the guest last heard their stories with. */
  guestCleanUp?: boolean;
  /** Straight from Save My Voice Free: says so when the demo take has expired. */
  fromTry?: boolean;
  /** No name chosen yet: ask on the ready step, since invitations show it. */
  askName?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);
  /** On the first step: make the voice from the /try take (preferred) or record a new one. */
  const [useDemo, setUseDemo] = useState(guestTake !== null);
  const [take, setTake] = useState<TakeDetails | null>(null);
  const [cleanUp, setCleanUp] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState<{ url: string; cleanUp: boolean; standIn: boolean } | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [afterFeedback, setAfterFeedback] = useState(false);
  /** Making the voice from the /try take instead of a new recording. */
  const [fromGuest, setFromGuest] = useState(false);
  const [guestTakeLive, setGuestTakeLive] = useState(guestTake !== null);

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
    setFromGuest(false);
    setStep(2);
    void makeVoice({ take: t }, t.recorded.qc.issues.includes("noisy"));
  };

  const chooseGuestTake = () => {
    setTake(null);
    setFromGuest(true);
    setCleanUp(guestCleanUp);
    setSample(null);
    setPhase("idle");
    setError(null);
    setStep(2);
    void makeVoice({ guest: true }, guestCleanUp);
  };

  /** Makes the candidate voice and its sample. Source and clean-up are passed in, since state set in the same tick isn't read yet. */
  const makeVoice = async (source: { guest: true } | { take: TakeDetails | null } = fromGuest ? { guest: true } : { take }, clean = cleanUp) => {
    const useGuest = "guest" in source;
    const recording = "take" in source ? source.take : null;
    if (!recording && !useGuest) return;
    setError(null);
    setPhase("making");
    try {
      if (useGuest) {
        const made = await fetch("/api/voice/from-guest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ consents: VOICE_CONSENTS, removeBackgroundNoise: clean }),
        });
        if (made.status === 410) throw new GuestTakeGone(await errorMessage(made, "Your earlier recording isn't here anymore. Please record your voice again."));
        if (!made.ok) throw new Error(await errorMessage(made, "We couldn't make your voice just now. Please try again."));
      } else if (recording) {
        const take = recording;
        const form = new FormData();
        form.append("audio", take.recorded.blob, "take");
        form.append("durationMs", String(Math.round(take.recorded.durationMs)));
        form.append("wpm", String(take.wpm));
        form.append("pauseCount", String(take.pauseCount));
        form.append("deviceClass", deviceClass());
        if (take.scriptOffsetEnd !== null) form.append("scriptOffsetEnd", String(take.scriptOffsetEnd));
        for (const c of VOICE_CONSENTS) form.append("consent", c);
        form.append("removeBackgroundNoise", String(clean));
        form.append("afterFeedback", String(afterFeedback));
        for (const issue of take.recorded.qc.issues) form.append("qcIssue", issue);
        const made = await fetch("/api/voice", { method: "POST", body: form });
        if (!made.ok) throw new Error(await errorMessage(made, "We couldn't make your voice just now. Please try again."));
      }

      setPhase("sampling");
      const res = await fetch("/api/voice/sample?candidate=1", { method: "POST" });
      if (!res.ok) throw new Error(await errorMessage(res, "Your voice is saved, but we couldn't play a sample just now."));
      setSample({ url: URL.createObjectURL(await res.blob()), cleanUp: clean, standIn: res.headers.get("x-readli-stand-in") === "1" });
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPhase("error");
      if (err instanceof GuestTakeGone) {
        // Deleted on its 24-hour schedule: back to the recorder, with the reason showing.
        setGuestTakeLive(false);
        setUseDemo(false);
        setFromGuest(false);
        setStep(1);
      }
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
    // Asking to record again means a new reading, not the /try take.
    if (fromGuest) setUseDemo(false);
    setFromGuest(false);
    setSample(null);
    setPhase("idle");
    setError(null);
    setStep(1);
  };

  const busy = phase === "making" || phase === "sampling" || phase === "keeping";

  const myVoice = parent ? "/family/my-voice" : "/voice";
  const demoOffered = guestTakeLive && guestTake !== null;
  const choice = (on: boolean) => `flex items-start gap-3 rounded-3xl bg-surface p-4 ${on ? "ring-[3px] ring-coral-deep" : "ring-2 ring-ink/15"}`;

  return (
    <div className="flex flex-col gap-6">
      {step === 0 && (
        <section className="flex max-w-2xl flex-col gap-5" data-testid="voice-start">
          {fromTry && !guestTake && (
            <p className="rounded-2xl bg-sunshine/60 p-4" data-testid="demo-take-expired">
              Your demo recording has expired (they&apos;re kept for 24 hours), so you&apos;ll read the short story once more. It takes about a minute.
            </p>
          )}
          {hasVoice && (
            <p className="rounded-2xl bg-sunshine/50 p-4" data-testid="replacing-voice">
              Your current voice keeps working until you hear the new one and choose to keep it. Families you share with keep hearing you either way.
            </p>
          )}
          {demoOffered && (
            <fieldset className="flex flex-col gap-3" data-testid="guest-take-offer">
              <legend className="mb-2 font-display text-xl font-semibold">Which recording?</legend>
              <label className={choice(useDemo)}>
                <input type="radio" name="recording" checked={useDemo} onChange={() => setUseDemo(true)} className="mt-1 size-5 shrink-0 accent-coral-deep" />
                <span className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">Use this recording</span>
                    <span className="rounded-full bg-mint px-2.5 py-0.5 text-sm font-bold">Recommended</span>
                  </span>
                  <span>
                    The story you read on the demo · {formatClock(guestTake.durationMs)}
                  </span>
                  <span className="text-sm text-muted">
                    We&apos;ll make a new sample from it, so you hear how your Readli voice sounds. The recording is kept until{" "}
                    {new Date(guestTake.expiresAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}, then deleted.
                  </span>
                </span>
              </label>
              <label className={choice(!useDemo)}>
                <input type="radio" name="recording" checked={!useDemo} onChange={() => setUseDemo(false)} className="mt-1 size-5 shrink-0 accent-coral-deep" />
                <span className="flex flex-col gap-1">
                  <span className="text-lg font-semibold">Record a new one</span>
                  <span className="text-sm text-muted">Read a short story out loud, about a minute.</span>
                </span>
              </label>
            </fieldset>
          )}
          <label className="flex items-start gap-3 rounded-2xl bg-lavender/40 p-4">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 size-5 shrink-0 accent-coral-deep" />
            <span>{VOICE_CONSENT_SENTENCE}</span>
          </label>
          <button type="button" className={`${buttonPrimary} w-full sm:w-fit`} disabled={!agreed} onClick={() => (demoOffered && useDemo ? chooseGuestTake() : setStep(1))}>
            {demoOffered && useDemo ? "Create & Hear My Voice" : "Continue to recording"}
          </button>
        </section>
      )}

      {step === 1 && error && (
        <p role="alert" className="rounded-2xl border-[3px] border-coral-deep bg-surface p-4 font-semibold">
          {error}
        </p>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold">Read the story out loud</h2>
          <p>Read the whole story, about one to two minutes. Find a quiet spot and read it in your natural, warm storytime voice. Your Readli voice copies how you read.</p>
          <TeleprompterRecorder script={DEMO_SCRIPT} onTake={takeChosen} takeActionLabel="Create & Hear My Voice" />
        </section>
      )}

      {step === 2 && (take || fromGuest) && (
        <section className="flex max-w-2xl flex-col gap-4 rounded-[var(--radius-panel)] bg-sky/40 p-5 sm:p-8" data-testid="account-voice-check">
          <h2 className="font-display text-2xl font-semibold">{busy && phase !== "keeping" ? "Creating your voice" : "Does this sound like you?"}</h2>

          {busy && (
            <div role="status" className="flex items-center gap-4 rounded-2xl bg-plum p-4 text-white">
              <ReadiMascot state="listening" size={72} decorative className="animate-bob" />
              <p className="font-display text-lg font-semibold">{phase === "making" ? "Readi is listening to your voice…" : phase === "keeping" ? "Saving your voice…" : "Getting your sample ready…"}</p>
            </div>
          )}

          {sample && !busy && (
            <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
              <p className="font-semibold">Your Readli voice, reading a story</p>
              <p className="text-sm text-muted">New narration made from your recording. Tap play when you&apos;re ready.</p>
              <audio key={sample.url} controls src={sample.url} className="w-full" aria-label="A sample of your Readli voice" />
              <p className="text-sm text-muted">Noise clean-up {sample.cleanUp ? "on" : "off"}</p>
              {sample.standIn && <p className="text-sm font-semibold">Test mode: this is a stand-in sound, not your voice.</p>}
              <ImproveLink onOpen={() => setTipsOpen(true)} where="account_sample" />
              {hasVoice && <p className="text-sm text-muted">Your current voice stays in use until you keep this one.</p>}
            </div>
          )}

          {!busy && (
            <label className="flex items-start gap-3 rounded-2xl bg-surface p-4">
              <input type="checkbox" className="mt-1 size-6 shrink-0 accent-coral-deep" checked={cleanUp} onChange={(e) => setCleanUp(e.target.checked)} />
              <span className="flex flex-col gap-1">
                <span className="font-semibold">Clean up background noise</span>
                <span className="text-sm text-muted">Try it if your room was echoey or noisy. It can make a clean recording sound less like you.</span>
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="rounded-2xl border-[3px] border-coral-deep bg-surface p-4 font-semibold">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {phase === "ready" && sample?.cleanUp === cleanUp ? (
              <button type="button" className={buttonPrimary} onClick={() => void keepVoice()}>
                Keep This Voice
              </button>
            ) : (
              <button type="button" className={buttonPrimary} disabled={busy} onClick={() => void makeVoice()}>
                {sample ? `Try again with clean-up ${cleanUp ? "on" : "off"}` : busy ? "Creating…" : "Create & Hear My Voice"}
              </button>
            )}
            <button type="button" className={buttonSecondary} disabled={busy} onClick={() => recordAgain()}>
              Record Again
            </button>
          </div>
          <RecordingTipsDialog open={tipsOpen} onClose={() => setTipsOpen(false)} onRecordAgain={() => recordAgain(true)} where="account_sample" />
        </section>
      )}

      {step === 3 && (
        <section aria-live="polite" className="flex max-w-2xl flex-col items-center gap-4 rounded-[var(--radius-panel)] bg-mint/50 p-6 text-center sm:p-8" data-testid="voice-ready">
          <ReadiMascot size={120} decorative />
          <h2 className="font-display text-3xl font-semibold">Your Readli voice is ready!</h2>
          <p className="max-w-md">{next ? "Let's get back to where you were." : "Next, choose a story for your family to hear first. You'll approve it before anyone gets an invitation."}</p>
          {askName && (
            <div className="w-full text-left">
              <AskName label="What should families call you?" hint="Invitations use this name, like “Grandpa Joe has a bedtime story for your family.”" placeholder="Grandpa Joe, Nana, Aunt Sue…" />
            </div>
          )}
          <div className="flex w-full flex-col items-center gap-2 sm:w-auto">
            <Link href={next ?? "/voice/invite"} className={`${buttonPrimary} w-full sm:w-auto`}>
              {next ? "Continue" : "Choose a Story to Share"}
            </Link>
            {!next && (
              <Link href={myVoice} className={buttonQuiet}>
                Go to My Voice
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

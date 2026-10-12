"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { ImproveLink, RecordingTipsDialog } from "@/components/teleprompter/RecordingTips";
import { TeleprompterRecorder } from "@/components/teleprompter/TeleprompterRecorder";
import type { TakeDetails } from "@/components/teleprompter/VoicePreview";
import { PERMISSION_STATEMENTS, REQUIRED_AGREEMENT_STATEMENTS, THIRD_PARTY_LICENSING_STATEMENT, VOICE_AGREEMENT_PATH } from "@/lib/content/voice-agreement";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";

const STEPS = ["Agreement", "Record", "Check it's you", "Done"] as const;

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
 * Readli Voice for a signed-in grown-up: accept the Voice Recording & AI Training Agreement (saved
 * before the microphone starts), record with the teleprompter, make the voice, listen to a sample and
 * keep it. The voice is saved privately; sharing happens per family.
 * A new recording stays a candidate until "Keep my voice", so a working voice is never lost to a worse one.
 */
export function AccountVoiceSetup({ hasVoice }: { hasVoice: boolean }) {
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState<boolean[]>(REQUIRED_AGREEMENT_STATEMENTS.map(() => false));
  // Licensing to other companies is a separate choice and always starts off.
  const [licensing, setLicensing] = useState(false);
  const [agreementId, setAgreementId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const [take, setTake] = useState<TakeDetails | null>(null);
  const [cleanUp, setCleanUp] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState<{ url: string; cleanUp: boolean; standIn: boolean } | null>(null);
  /** This browser still has the take from the guest demo, which can become this grown-up's voice. */
  const [demoAvailable, setDemoAvailable] = useState(false);
  const [fromDemo, setFromDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/voice/from-demo", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ available?: boolean }>) : null))
      .then((s) => {
        if (!cancelled) setDemoAvailable(s?.available === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [afterFeedback, setAfterFeedback] = useState(false);

  useEffect(() => {
    return () => {
      if (sample) URL.revokeObjectURL(sample.url);
    };
  }, [sample]);

  const chooseDemo = () => {
    setFromDemo(true);
    setTake(null);
    setCleanUp(false);
    setSample(null);
    setPhase("idle");
    setError(null);
    setStep(2);
  };

  const takeChosen = (t: TakeDetails) => {
    setFromDemo(false);
    setTake(t);
    // Clean-up starts on only when the recorder heard a noisy room; quiet takes keep their natural sound.
    setCleanUp(t.recorded.qc.issues.includes("noisy"));
    setSample(null);
    setPhase("idle");
    setError(null);
    setStep(2);
  };

  const makeVoice = async () => {
    if (!take && !fromDemo) return;
    setError(null);
    setPhase("making");
    try {
      const made = take
        ? await uploadTake(take)
        : await fetch("/api/voice/from-demo", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ agreementId, removeBackgroundNoise: cleanUp }),
          });
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

  const uploadTake = (t: TakeDetails) => {
    const form = new FormData();
    form.append("audio", t.recorded.blob, "take");
    form.append("durationMs", String(Math.round(t.recorded.durationMs)));
    form.append("wpm", String(t.wpm));
    form.append("pauseCount", String(t.pauseCount));
    form.append("deviceClass", deviceClass());
    if (t.scriptOffsetEnd !== null) form.append("scriptOffsetEnd", String(t.scriptOffsetEnd));
    if (agreementId) form.append("agreementId", agreementId);
    form.append("qc", JSON.stringify({ speechMs: t.recorded.qc.speechMs, issues: t.recorded.qc.issues }));
    form.append("removeBackgroundNoise", String(cleanUp));
    form.append("afterFeedback", String(afterFeedback));
    for (const issue of t.recorded.qc.issues) form.append("qcIssue", issue);
    return fetch("/api/voice", { method: "POST", body: form });
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

  /** Saves the agreement first, so the record exists before the microphone is ever opened. */
  const acceptAgreement = async () => {
    setAgreementError(null);
    setAccepting(true);
    try {
      const statements = [...REQUIRED_AGREEMENT_STATEMENTS, ...(licensing ? [THIRD_PARTY_LICENSING_STATEMENT] : [])];
      const res = await fetch("/api/voice/agreement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ statements, thirdPartyLicensing: licensing }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "We couldn't save your agreement just now. Please try again."));
      const body = (await res.json()) as { agreement: { id: string } };
      setAgreementId(body.agreement.id);
      setStep(1);
    } catch (err) {
      setAgreementError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const licensingStatement = PERMISSION_STATEMENTS.find((p) => p.permission === "third_party_licensing")!;

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
        <section aria-labelledby="agreement-heading" className="flex flex-col gap-4 rounded-[var(--radius-panel)] border-[3px] border-ink bg-lavender/40 p-6 sm:p-8" data-testid="voice-agreement">
          <h2 id="agreement-heading" className="font-display text-2xl font-semibold">
            Voice Recording &amp; AI Training Agreement
          </h2>
          <p className="font-semibold">Please read this before you record. Your microphone doesn&apos;t switch on until you agree.</p>
          {hasVoice && (
            <p>
              You already have a Readli voice. If you record again, your current voice keeps working until you listen to the new one
              and choose to keep it. Families you share with keep hearing you either way.
            </p>
          )}
          <ul className="flex list-disc flex-col gap-1 pl-6 text-sm">
            <li>Readli keeps your original recording to make, remake and improve your private story voice.</li>
            <li>Readli also uses it to build and improve Readli&apos;s own voice technology.</li>
            <li>Licensing it to other companies is a separate choice. It stays off unless you turn it on.</li>
            <li>Children&apos;s voices and information are never shared for anyone else&apos;s AI training.</li>
          </ul>
          <p className="text-sm">
            <a href={VOICE_AGREEMENT_PATH} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">
              Read the full agreement
            </a>{" "}
            and our <a href="/privacy" target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">Privacy Policy</a>.
          </p>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-semibold">Required to record</legend>
            {REQUIRED_AGREEMENT_STATEMENTS.map((c, i) => (
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
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 font-semibold">{licensingStatement.title}</legend>
            <label className="flex items-start gap-3 rounded-2xl bg-surface p-4">
              <input
                type="checkbox"
                checked={licensing}
                onChange={(e) => setLicensing(e.target.checked)}
                className="mt-1 size-5 shrink-0 accent-coral-deep"
              />
              <span>{licensingStatement.statement}</span>
            </label>
          </fieldset>
          {agreementError && (
            <p role="alert" className="rounded-2xl border-[3px] border-coral-deep bg-surface p-4 font-semibold">
              {agreementError}
            </p>
          )}
          <button type="button" className={`${buttonPrimary} w-fit`} disabled={!agreed.every(Boolean) || accepting} onClick={() => void acceptAgreement()}>
            {accepting ? "Saving…" : "I agree"}
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold">Read the story out loud</h2>
          <p>Read the whole story, about one to two minutes. Find a quiet spot and read it in your natural, warm storytime voice. Your Readli voice copies how you read.</p>
          {demoAvailable && (
            <div className="flex flex-col gap-2 rounded-2xl bg-mint/50 p-4" data-testid="use-demo-take">
              <p className="font-semibold">You recorded a story in the demo on this device.</p>
              <p className="text-sm">Use that recording for your voice, or record a new one below for better quality. A demo recording is used only to make your voice, never for training, and the demo copy is deleted within 48 hours.</p>
              <button type="button" className={`${buttonSecondary} w-fit`} onClick={chooseDemo}>
                Use my demo recording
              </button>
            </div>
          )}
          <TeleprompterRecorder script={DEMO_SCRIPT} onTake={takeChosen} takeActionLabel="Use this recording" />
        </section>
      )}

      {step === 2 && (take || fromDemo) && (
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
            <Link href="/family/my-voice" className={buttonPrimary}>
              Choose who can use it
            </Link>
            <Link href="/family" className={buttonQuiet}>
              Back to my family
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

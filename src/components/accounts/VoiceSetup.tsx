"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonQuiet, buttonSecondary } from "@/components/brand/buttons";
import { TeleprompterRecorder } from "@/components/teleprompter/TeleprompterRecorder";
import { VOICE_CONSENTS } from "@/lib/content/voice-consents";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";

const STEPS = ["Check it's you", "Your voice, your rules", "Record", "Approve your voice"] as const;

const CONSENTS = VOICE_CONSENTS;

/**
 * Readli Voice screen 4: verify, consent, record with the teleprompter, then approve the result.
 * Approving keeps the voice private; sharing happens per family on the dashboard.
 */
export function VoiceSetup() {
  const id = useId();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState<boolean[]>(CONSENTS.map(() => false));
  const [approved, setApproved] = useState(false);

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
        <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Check it&apos;s you</h2>
          <p>We sent a 6-digit code to your email. Only you can make your voice, so we check before you record.</p>
          <label htmlFor={`${id}-code`} className="font-semibold">
            Code
          </label>
          <input
            id={`${id}-code`}
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="min-h-14 w-48 rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-center font-display text-2xl tracking-[0.3em] focus:border-ink"
          />
          <p className="text-sm text-muted">Preview: any six digits work.</p>
          <button type="button" className={`${buttonPrimary} w-fit`} disabled={code.length !== 6} onClick={() => setStep(1)}>
            Verify
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-lavender/40 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Your voice, your rules</h2>
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Your agreement</legend>
            {CONSENTS.map((c, i) => (
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
          <button type="button" className={`${buttonPrimary} w-fit`} disabled={!agreed.every(Boolean)} onClick={() => setStep(2)}>
            I agree
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold">Read the story out loud</h2>
          <p>About a minute or two. Find a quiet spot and read it like a bedtime story, with lots of expression. Your voice copies how you read.</p>
          <TeleprompterRecorder script={DEMO_SCRIPT} />
          <button type="button" className={`${buttonSecondary} w-fit`} onClick={() => setStep(3)}>
            I&apos;ve finished recording
          </button>
        </section>
      )}

      {step === 3 && !approved && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sky/40 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Does this sound like you?</h2>
          <p>Listen to a short sample of your Readli voice. Approve it only if you&apos;re happy for families you choose to hear it.</p>
          <div className="flex items-center gap-4 rounded-2xl bg-surface p-4">
            <ReadiMascot size={64} state="listening" decorative />
            <span className="text-sm">Preview: your sample plays here once voices switch on.</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonPrimary} onClick={() => setApproved(true)}>
              Approve my voice
            </button>
            <button type="button" className={buttonSecondary} onClick={() => setStep(2)}>
              Record again
            </button>
            <Link href="/voice" className={buttonQuiet}>
              Not now
            </Link>
          </div>
        </section>
      )}

      {approved && (
        <section aria-live="polite" className="flex flex-col items-center gap-4 rounded-[var(--radius-panel)] bg-mint/50 p-8 text-center">
          <ReadiMascot size={130} decorative />
          <h2 className="font-display text-3xl font-semibold">Your voice is ready</h2>
          <p className="max-w-md">It&apos;s private. Nobody can use it until you share it with a family, and their parents approve it for each child.</p>
          <Link href="/voice" className={buttonPrimary}>
            Choose who can use it
          </Link>
        </section>
      )}
    </div>
  );
}

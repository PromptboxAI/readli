import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";

/**
 * After a guest has heard a story in their own voice (Kevin, 2026-10-21): the main next step is saving
 * the voice in a free Readli Voice account, with no subscription or card. Readli Family's trial is the
 * second choice, with its payment terms shown before anyone signs up. Both keep the demo take: signing
 * up on this device lets the new account use it. `trialDays` is 0 where the trial isn't offered yet.
 */
export function DemoTrialPrompt({ trialDays, trialCredits, monthlyPrice }: { trialDays: number; trialCredits: number; monthlyPrice: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-panel bg-sunshine/60 p-5" data-testid="demo-trial">
      <p className="font-display text-xl font-semibold">Keep your voice</p>
      <p>
        Save this recording as your free Readli Voice and share it with the families you choose. It&apos;s free, with no subscription and no card.
        Sign up on this device within 24 hours of recording to keep this take.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href="/signup/voice?from=demo" className={buttonPrimary} data-testid="save-voice">
          Save My Voice — Free
        </Link>
        {trialDays > 0 ? (
          <Link href="/signup/family?from=demo" className={buttonSecondary} data-testid="family-trial-link">
            Start My {trialDays}-Day Family Trial
          </Link>
        ) : (
          <Link href="/pricing" className={buttonSecondary}>
            See Readli Family plans
          </Link>
        )}
      </div>
      {trialDays > 0 && (
        <p className="text-sm" data-testid="trial-terms">
          Readli Family trial: {trialDays} days with {trialCredits} narration credits for new stories. A card is required to start. When the trial ends
          you&apos;re charged {monthlyPrice} a month (or the yearly price if you choose it) until you cancel; cancel before then and you won&apos;t pay
          anything. You&apos;ll see the full terms before you start.
        </p>
      )}
    </div>
  );
}

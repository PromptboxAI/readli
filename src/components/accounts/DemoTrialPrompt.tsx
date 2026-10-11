import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";

/**
 * After a guest hears a story in their own voice: the next step is Readli Family's free trial.
 * The trial always takes a card, and nothing is charged until it ends. `trialDays` is 0 where the
 * trial isn't offered yet, and then the prompt points at the plans instead.
 */
export function DemoTrialPrompt({ trialDays, trialCredits }: { trialDays: number; trialCredits: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-panel bg-sunshine/60 p-5" data-testid="demo-trial">
      <p className="font-display text-xl font-semibold">Want your kids to hear stories in your voice every night?</p>
      {trialDays > 0 ? (
        <>
          <p>
            Try Readli Family free for {trialDays} days, with {trialCredits} narration credits for new stories. We ask for a card when you sign up, and
            nothing is charged until the trial ends. Cancel before then and you won&apos;t pay anything.
          </p>
          <p className="text-sm">
            Sign up on this device within 24 hours to keep this recording as your Readli voice, or record a new one later for even better quality.
          </p>
          <Link href="/signup/family?from=demo" className={`${buttonPrimary} self-start`}>
            Start your free trial
          </Link>
        </>
      ) : (
        <>
          <p>Readli Family opens soon. See what&apos;s included and what it costs.</p>
          <Link href="/pricing" className={`${buttonPrimary} self-start`}>
            See plans
          </Link>
        </>
      )}
    </div>
  );
}

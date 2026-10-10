"use client";

import Link from "next/link";
import { useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary, buttonQuiet } from "@/components/brand/buttons";
import { FollowReadliStory } from "@/components/rewards/FollowReadliStory";
import { RewardsCard } from "@/components/rewards/RewardsTracker";
import { ACTIVITIES, type ActivityId } from "@/lib/rewards/rewards";

/**
 * Last steps of adult onboarding: meet Readli Rewards, then an optional "Follow Readli's Story".
 * Both can be skipped; neither blocks finishing registration. While Readli Rewards is off, the
 * first step welcomes the family without mentioning rewards.
 */
export function WelcomeSteps({ showRewards = true }: { showRewards?: boolean }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const justJoined = { completed: new Set<ActivityId>(["family_account"]), pendingReferrals: 0, monthsEarned12: 0, monthsBanked: 0 };

  return (
    <div className="flex flex-col gap-6">
      <p className="font-display font-semibold" aria-live="polite">
        Step {step} of 3
      </p>
      {step === 1 && (
        <section className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-sky/40 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <ReadiMascot size={110} decorative />
            <div>
              <h1 className="font-display text-3xl font-semibold sm:text-4xl">Welcome to Readli Family!</h1>
              <p className="text-lg">
                {showRewards ? "You just earned your first sticker for creating your family account." : "Your family's home for stories is ready."}
              </p>
            </div>
          </div>
          {showRewards && (
            <>
              <h2 className="font-display text-2xl font-semibold">Meet Readli Rewards</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {ACTIVITIES.slice(1).map((a) => (
                  <li key={a.id} className="rounded-2xl bg-surface p-3">
                    <span className="font-display font-semibold">{a.title}</span>
                  </li>
                ))}
              </ul>
              <RewardsCard state={justJoined} />
            </>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonPrimary} onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </section>
      )}
      {step === 2 && (
        <>
          <FollowReadliStory headingLevel={1} />
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonPrimary} onClick={() => setStep(3)}>
              Continue
            </button>
            <button type="button" className={buttonQuiet} onClick={() => setStep(3)}>
              Skip
            </button>
          </div>
        </>
      )}
      {step === 3 && (
        <section className="flex flex-col items-center gap-4 rounded-[var(--radius-panel)] bg-mint/50 p-8 text-center">
          <ReadiMascot size={130} decorative />
          <h1 className="font-display text-3xl font-semibold">You&apos;re all set</h1>
          <p>Next, set up your family library and invite your first storyteller.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/invite" className={buttonPrimary}>
              Invite family
            </Link>
            {showRewards && (
              <Link href="/rewards" className={buttonQuiet}>
                See Readli Rewards
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

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
  const [name, setName] = useState("");

  // The name is asked for here, after payment, rather than at signup. Saving needs a signed-in
  // account; in the preview there isn't one, so a failed save just moves on.
  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/api/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name.trim() }) }).catch(() => null);
    setStep(2);
  };
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
          <form className="flex flex-col gap-3" onSubmit={saveName}>
            <label htmlFor="welcome-name" className="font-display text-xl font-semibold">
              What should your family call you?
            </label>
            <p className="-mt-2 text-sm">This is how you&apos;ll appear to your kids and storytellers. You can change it later in Settings.</p>
            <input
              id="welcome-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mom, Dad, Sara…"
              autoComplete="name"
              maxLength={60}
              required
              className="min-h-12 w-full max-w-sm rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg focus:border-ink"
            />
            <div className="flex flex-wrap gap-3">
              <button type="submit" className={buttonPrimary} disabled={!name.trim()}>
                Next
              </button>
            </div>
          </form>
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

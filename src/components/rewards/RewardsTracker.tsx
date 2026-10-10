"use client";

import Link from "next/link";
import { useState } from "react";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonSecondary } from "@/components/brand/buttons";
import { StarSticker } from "@/components/invites/illustrations";
import { ACTIVITIES, progress, REWARD_RULES, type ActivityId, type RewardsState } from "@/lib/rewards/rewards";

const NEXT_LINK: Partial<Record<ActivityId, { href: string; label: string }>> = {
  invite_storyteller: { href: "/invite/family", label: "Invite someone" },
  first_voice_or_story: { href: "/#try-your-voice", label: "Record your voice" },
  referral: { href: "#refer", label: "Get your link" },
};

/** Sample progress for the preview: two starter steps done. */
export const SAMPLE_REWARDS: RewardsState = {
  completed: new Set<ActivityId>(["family_account", "family_library"]),
  eligibleNewHousehold: true,
  qualifyingReferrals: 0,
};

/** Readli Rewards progress tracker. Adults only; never rendered in Readli Kids. */
export function RewardsTracker({ state = SAMPLE_REWARDS }: { state?: RewardsState }) {
  const [copied, setCopied] = useState(false);
  const p = progress(state);
  const pct = Math.round((p.starterDone / p.starterTotal) * 100);
  const introEarned = p.rewards.some((r) => r.id === "intro_free_month");
  const referralMonths = p.rewards.filter((r) => r.id === "referral_free_month").length;
  const nextId = ACTIVITIES.find((a) => !state.completed.has(a.id))?.id;

  async function copy() {
    try {
      await navigator.clipboard.writeText("https://readli.ai/r/preview");
      setCopied(true);
    } catch {
      /* Clipboard blocked; the link is visible to copy by hand. */
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="progress-heading" className="flex flex-col gap-5 rounded-[var(--radius-panel)] bg-sky/40 p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <ReadiMascot size={96} decorative />
          <div className="flex-1">
            <h2 id="progress-heading" className="font-display text-2xl font-semibold sm:text-3xl">
              Your story path
            </h2>
            <p>
              {p.starterDone} of {p.starterTotal} starter activities done
            </p>
            <div
              role="progressbar"
              aria-label="Starter activities"
              aria-valuemin={0}
              aria-valuemax={p.starterTotal}
              aria-valuenow={p.starterDone}
              className="mt-2 h-4 overflow-hidden rounded-full bg-surface ring-2 ring-ink/20"
            >
              <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <ol className="grid gap-3 md:grid-cols-5" data-testid="rewards-activities">
          {ACTIVITIES.map((a) => {
            const done = state.completed.has(a.id);
            const link = !done && NEXT_LINK[a.id];
            return (
              <li
                key={a.id}
                className={`flex items-start gap-3 rounded-3xl p-4 md:flex-col md:items-center md:text-center ${done ? "bg-surface" : "bg-surface/60"} ${a.id === nextId ? "ring-[3px] ring-ink" : ""}`}
              >
                <StarSticker done={done} className="size-12 shrink-0" />
                <span className="flex flex-col gap-1">
                  <span className="font-display font-semibold leading-tight">{a.title}</span>
                  <span className="text-sm">{done ? `Sticker earned: ${a.sticker}` : a.detail}</span>
                  <span className="sr-only">{done ? "Done" : "Not done yet"}</span>
                  {link && (
                    <Link href={link.href} className="font-display text-sm font-semibold underline underline-offset-4">
                      {link.label}
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="earned-heading" className="flex flex-col gap-3 rounded-[var(--radius-panel)] bg-sunshine/60 p-6">
          <h2 id="earned-heading" className="font-display text-2xl font-semibold">
            Your rewards
          </h2>
          <div className={`flex items-center gap-3 rounded-2xl p-4 ${introEarned ? "bg-mint" : "bg-surface/80"}`}>
            <span aria-hidden="true" className="text-3xl">
              {introEarned ? "🎉" : "🔒"}
            </span>
            <span>
              <span className="block font-display text-lg font-semibold">{REWARD_RULES.introFreeMonth.title}</span>
              <span className="block text-sm">
                {introEarned
                  ? "Unlocked! It'll be applied to your first paid month."
                  : `Finish the ${p.starterTotal - p.starterDone} remaining starter ${p.starterTotal - p.starterDone === 1 ? "activity" : "activities"} to unlock it.`}
              </span>
            </span>
          </div>
          <p className="text-sm">
            Referral months earned: <span className="font-semibold">{referralMonths}</span>
          </p>
        </section>

        <section id="refer" aria-labelledby="refer-heading" className="flex scroll-mt-24 flex-col gap-3 rounded-[var(--radius-panel)] bg-mint/50 p-6">
          <h2 id="refer-heading" className="font-display text-2xl font-semibold">
            Share Readli with a friend
          </h2>
          <p>When a new household you refer starts a qualifying paid subscription, you earn {REWARD_RULES.referralFreeMonth.title.toLowerCase()}.</p>
          <p className="break-all rounded-2xl bg-surface p-3 font-mono text-sm">readli.ai/r/preview</p>
          <button type="button" className={`${buttonSecondary} w-fit`} onClick={copy}>
            {copied ? "Link copied" : "Copy my link"}
          </button>
        </section>
      </div>

      <p className="text-sm text-muted" data-testid="rewards-fine-print">
        Rewards are for adults and are still being finalised: amounts and eligibility follow Readli&apos;s final pricing. One
        introductory month per new household. Gifts and free trials don&apos;t count as referrals. Following or liking Readli on
        social media never earns rewards.
      </p>
    </div>
  );
}

/** Compact tracker for the Family dashboard. No props. */
export function RewardsCard({ state = SAMPLE_REWARDS }: { state?: RewardsState }) {
  const p = progress(state);
  return (
    <Link
      href="/rewards"
      className="flex items-center gap-4 rounded-[var(--radius-panel)] bg-sunshine/60 p-5 ring-2 ring-ink/10 transition-transform hover:-translate-y-0.5 hover:ring-ink"
    >
      <span className="flex gap-1" aria-hidden="true">
        {ACTIVITIES.slice(0, 4).map((a) => (
          <StarSticker key={a.id} done={state.completed.has(a.id)} className="size-8" />
        ))}
      </span>
      <span>
        <span className="block font-display text-xl font-semibold">Readli Rewards</span>
        <span className="block text-sm">
          {p.starterDone} of {p.starterTotal} done. {p.rewards.length ? "You've unlocked a reward!" : "Finish them to unlock a free month."}
        </span>
      </span>
    </Link>
  );
}

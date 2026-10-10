import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { FollowReadliStory } from "@/components/rewards/FollowReadliStory";
import { RewardsTracker } from "@/components/rewards/RewardsTracker";
import { rewardsConfig, rewardsVisible } from "@/lib/rewards/rewards";

export const metadata: Metadata = { title: "Readli Rewards | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function RewardsPage() {
  const config = rewardsConfig();
  if (!rewardsVisible(config)) notFound();
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>For grown-ups</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Readli Rewards</h1>
        <p className="max-w-2xl text-lg">Collect a sticker for each step that brings your family&apos;s stories to life, and earn free months by sharing Readli.</p>
      </header>
      <PreviewNote>
        {config.programPublic ? "This shows example progress." : "Readli Rewards isn't switched on yet. This shows example progress."} Your real progress
        appears once family accounts arrive.
      </PreviewNote>
      <RewardsTracker config={config} />
      <FollowReadliStory />
    </AdultPage>
  );
}

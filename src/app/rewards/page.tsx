import type { Metadata } from "next";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { FollowReadliStory } from "@/components/rewards/FollowReadliStory";
import { RewardsTracker } from "@/components/rewards/RewardsTracker";

export const metadata: Metadata = { title: "Readli Rewards | Readli", robots: { index: false } };

export default function RewardsPage() {
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>For grown-ups</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Readli Rewards</h1>
        <p className="max-w-2xl text-lg">Collect a sticker for each step that brings your family&apos;s stories to life.</p>
      </header>
      <PreviewNote>This shows example progress. Your real progress appears once family accounts arrive.</PreviewNote>
      <RewardsTracker />
      <FollowReadliStory />
    </AdultPage>
  );
}

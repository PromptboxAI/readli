import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdultPage, Eyebrow, PreviewNote } from "@/components/invites/AdultPage";
import { FollowReadliStory } from "@/components/rewards/FollowReadliStory";
import { RewardsTracker } from "@/components/rewards/RewardsTracker";
import { rewardsPage } from "@/lib/rewards/page-data";
import { rewardsConfig, rewardsVisible } from "@/lib/rewards/rewards";

export const metadata: Metadata = { title: "Readli Rewards | Readli", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const config = rewardsConfig();
  if (!rewardsVisible(config)) notFound();
  const data = await rewardsPage();
  if (data.mode === "sign_in") redirect("/login?next=/rewards");
  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>For grown-ups</Eyebrow>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Readli Rewards</h1>
        <p className="max-w-2xl text-lg">Collect a sticker for each step that brings your family&apos;s stories to life, and earn free months by sharing Readli.</p>
      </header>
      {data.mode === "live" ? (
        !config.programPublic && <PreviewNote>Readli Rewards isn&apos;t switched on yet, so referrals won&apos;t earn months until it is.</PreviewNote>
      ) : (
        <PreviewNote>
          {config.programPublic ? "This shows example progress." : "Readli Rewards isn't switched on yet. This shows example progress."} Sign in to
          see your own.
        </PreviewNote>
      )}
      {data.mode === "live" ? <RewardsTracker config={config} state={data.state} link={data.link} /> : <RewardsTracker config={config} />}
      <FollowReadliStory />
    </AdultPage>
  );
}

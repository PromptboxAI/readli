import { RewardsCard } from "@/components/rewards/RewardsTracker";
import { rewardsPage } from "@/lib/rewards/page-data";
import { rewardsVisible } from "@/lib/rewards/rewards";

/** Readli Rewards card for the Family dashboard. Renders nothing until the program is public (previews always show it). */
export async function FamilyRewardsCard() {
  if (!rewardsVisible()) return null;
  const data = await rewardsPage();
  return <RewardsCard state={data.mode === "live" ? data.state : undefined} />;
}

import { RewardsCard } from "@/components/rewards/RewardsTracker";
import { rewardsVisible } from "@/lib/rewards/rewards";

/** Readli Rewards card for the Family dashboard. Renders nothing until the program is public (previews always show it). */
export function FamilyRewardsCard() {
  return rewardsVisible() ? <RewardsCard /> : null;
}

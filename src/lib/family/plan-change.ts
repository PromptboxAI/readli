import type { Actor, PlanTier } from "./model";
import { activeEntitlement, tierOf } from "./permissions";
import { audit, PermissionError, requireHouseholdGuardian, type FamilyStore } from "./service";
import { stopHouseholdNarration } from "@/lib/narration/narration";

/**
 * Moving between Readli Family and the Readli Family Archive ($6.99/month by default). The Archive keeps
 * the library, listening, kids profiles, relationships and permissions, and every original recording;
 * it has no new stories, monthly credits or extra narrator slots, and playback never needs a provider
 * clone. Moving down never deletes anything; moving back up makes new stories again with the
 * contributors' authorizations that are still valid (retired clones are re-made from the original
 * recordings when first needed). Narration still being prepared stops when moving down, and the
 * credits it hadn't used go back to their lots.
 *
 * A Stripe subscription changes plan in the billing portal, and the webhook sets the tier. Tester plans,
 * and every plan in the preview, switch here directly. A gift, donated or trial plan keeps Readli Family
 * until it ends; the family can choose the Archive then.
 */

type Clock = () => Date;

export async function switchPlanTier(
  store: FamilyStore,
  actor: Actor | null,
  householdId: string,
  tier: PlanTier,
  clock: Clock = () => new Date(),
): Promise<{ from: PlanTier; tier: PlanTier; stoppedJobs: number }> {
  const state = await store.read();
  const adultId = requireHouseholdGuardian(state, actor, householdId);
  const at = clock().toISOString();
  const current = activeEntitlement(state, householdId, at);
  if (!current) throw new PermissionError(402, "no_plan", "Choose Readli Family or the Family Archive first.");
  const from = tierOf(current);
  if (from === tier) return { from, tier, stoppedJobs: 0 };
  const direct = current.source === "tester" || store.plan.simulatedCheckout;
  if (!direct && current.source === "subscription") {
    throw new PermissionError(409, "use_billing_portal", "Change your plan in billing, and we'll switch it as soon as the change goes through.");
  }
  if (!direct) throw new PermissionError(409, "plan_covered", "Your Readli Family plan is covered until it ends. You can choose the Family Archive then.");
  let stoppedJobs = 0;
  await store.write((s) => {
    const e = s.entitlements.find((x) => x.id === current.id)!;
    e.tier = tier;
    if (tier === "archive") stoppedJobs = stopHouseholdNarration(s, householdId, at);
    audit(s, adultId, "plan_changed", at, { householdId, detail: `${from}->${tier}${stoppedJobs ? `:stopped=${stoppedJobs}` : ""}` });
  });
  return { from, tier, stoppedJobs };
}

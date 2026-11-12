import type { SupabaseClient } from "@supabase/supabase-js";
import { familyCheckoutOpen } from "@/lib/accounts/checkout";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi } from "@/lib/billing/stripe-api";
import type { FamilyState } from "@/lib/family/model";
import { homeHousehold } from "@/lib/family/service";

/**
 * The family a grown-up started only to go to checkout: it never had a plan or a gift, and nobody but them has
 * been in it, and it has no kids. Its id, or null when they have no such family.
 */
export function unstartedFamily(state: FamilyState | null, adultId: string): string | null {
  if (!state) return null;
  const home = homeHousehold(state, adultId);
  if (!home) return null;
  const household = state.households.find((h) => h.id === home);
  if (!household || household.ownerId !== adultId) return null;
  if (state.entitlements.some((e) => e.householdId === home)) return null;
  if (state.members.some((m) => m.householdId === home && m.adultId !== adultId)) return null;
  if (state.children.some((c) => c.householdId === home)) return null;
  return home;
}

/**
 * Someone who backed out of checkout goes back to being a plain free account instead of keeping a family with
 * no plan. Any checkout still open for that family is closed first, so it can't be paid for afterwards; if that
 * can't be done, the family stays. Only while payments are on: before then, starting a family needs no checkout.
 * True when the family was removed.
 */
export async function discardUnstartedFamily(db: SupabaseClient | null, state: FamilyState | null, adultId: string): Promise<boolean> {
  const config = billingConfig();
  if (!db || !familyCheckoutOpen() || config.mode === "off" || !config.secretKey) return false;
  const home = unstartedFamily(state, adultId);
  if (!home) return false;
  try {
    await new StripeApi(config).expireOpenCheckouts(home);
  } catch (err) {
    console.error("unstarted family: couldn't close its checkout, keeping it", err);
    return false;
  }
  const { error } = await db.from("households").delete().eq("id", home).eq("created_by", adultId);
  if (error) {
    console.error("unstarted family: delete failed", error.message);
    return false;
  }
  return true;
}

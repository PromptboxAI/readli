import type { SupabaseClient } from "@supabase/supabase-js";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi } from "@/lib/billing/stripe-api";
import { addMonths } from "@/lib/narration/credits";
import { subscriptionPaidUntil, viewerPlan, type ViewerPlan } from "./server";

export interface GiftViewer {
  signedIn: boolean;
  hasFamily: boolean;
  plan: ViewerPlan;
  /** For a paying subscriber: when billing would pause and when it would start again. */
  pause: { from: string; until: string } | null;
}

export const SIGNED_OUT: GiftViewer = { signedIn: false, hasFamily: false, plan: "none", pause: null };

/** What the signed-in grown-up already has, for the claim page. Never changes anything. */
export async function giftViewer(db: SupabaseClient, userId: string | null, months: number): Promise<GiftViewer> {
  if (!userId) return SIGNED_OUT;
  const mine = await viewerPlan(db, userId);
  let pause: GiftViewer["pause"] = null;
  const config = billingConfig();
  if (mine.plan === "subscription" && mine.subscriptionRef && config.mode !== "off") {
    try {
      const from = subscriptionPaidUntil(await new StripeApi(config).getSubscription(mine.subscriptionRef));
      if (from) pause = { from, until: addMonths(from, months) };
    } catch {
      pause = null;
    }
  }
  return { signedIn: true, hasFamily: mine.hasFamily, plan: mine.plan, pause };
}

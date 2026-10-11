import { NextResponse } from "next/server";
import { catalogItem } from "@/lib/billing/catalog";
import { billingConfig } from "@/lib/billing/config";
import { planChange, type PlanTarget } from "@/lib/billing/plan-change";
import { effectivePlan } from "@/lib/billing/price-settings";
import { StripeApi, StripeError } from "@/lib/billing/stripe-api";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody, withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";
import { writeAudit } from "@/lib/lifecycle/db";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGETS: PlanTarget[] = ["family_monthly", "family_annual", "archive_monthly"];

const REFUSALS = {
  no_plan_item: [409, "We couldn't find your Readli plan in billing. Please contact admin@readli.ai."],
  same_plan: [409, "You're already on that plan."],
  not_active: [409, "Your plan isn't active, so it can't be changed. Start a new plan instead."],
  in_trial: [409, "Your free trial already includes Readli Family. You can change plan once it ends."],
  has_slots: [409, "Extra storyteller slots bill monthly. Remove them in billing first, then switch to yearly."],
} as const;

/**
 * { to: "family_monthly" | "family_annual" | "archive_monthly" }: changes the household's Stripe
 * subscription. The household's plan changes only when Stripe confirms it through the webhook.
 */
export async function POST(req: Request) {
  const config = billingConfig();
  if (config.mode === "off") return fail(404, "not_found", "Not found.");
  const { to } = await jsonBody(req);
  if (!TARGETS.includes(to as PlanTarget)) return fail(400, "bad_request", "Choose a plan.");
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId || actor.kind !== "adult") return fail(403, "not_guardian", "Only a parent or guardian can change your family's plan.");
    const db = accountDb();
    if (!db) return fail(503, "no_account", "Sign in with a Readli account to manage billing.");
    const { data: ent } = await db
      .from("household_entitlements")
      .select("provider_subscription_ref")
      .eq("household_id", householdId)
      .eq("source", "subscription")
      .eq("status", "active")
      .not("provider_subscription_ref", "is", null)
      .limit(1)
      .maybeSingle();
    if (!ent?.provider_subscription_ref) return fail(404, "no_subscription", "Your family doesn't have a paid plan to change.");
    const plan = await effectivePlan(db);
    const stripe = new StripeApi(config);
    try {
      const sub = await stripe.subscription(ent.provider_subscription_ref as string);
      if (sub.metadata?.household_id && sub.metadata.household_id !== householdId) return fail(403, "not_yours", "That plan belongs to another family.");
      const price = await stripe.priceFor(catalogItem(plan, to as string)!);
      const change = planChange(sub, to as PlanTarget, price, Math.floor(Date.now() / 1000));
      if (!change.ok) {
        const [status, message] = REFUSALS[change.reason];
        return fail(status, change.reason, message);
      }
      // A retried click within the same minute reuses the key, so Stripe applies the change once.
      const key = `plan-change:${sub.id}:${change.from}->${change.to}:${Math.floor(Date.now() / 60_000)}`;
      const updated = await stripe.updateSubscription(sub.id, change.params, key);
      await writeAudit(db, [{ actor: actor.adultId, action: "plan_change_requested", householdId, detail: { from: change.from, to: change.to, pending: Boolean(updated.pending_update) } }]).catch(
        (err) => console.error("plan change log failed", err),
      );
      return NextResponse.json({ from: change.from, to: change.to, pending: Boolean(updated.pending_update) });
    } catch (err) {
      if (err instanceof StripeError) return fail(402, "stripe_error", "Billing couldn't make that change. Please check your card in billing and try again.");
      throw err;
    }
  });
}

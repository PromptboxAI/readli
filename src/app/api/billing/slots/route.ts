import { NextResponse } from "next/server";
import { applyBillingChange } from "@/lib/billing/apply";
import { slotItemFor } from "@/lib/billing/catalog";
import { billingConfig } from "@/lib/billing/config";
import { billingChange } from "@/lib/billing/events";
import { effectivePlan } from "@/lib/billing/price-settings";
import { slotUpdate, subscriptionSlots, type StripeSubItem } from "@/lib/billing/slots";
import { StripeApi, StripeError } from "@/lib/billing/stripe-api";
import { accountDb, AccountFamilyStore } from "@/lib/family/account-store";
import { jsonBody, withFamily } from "@/lib/family/http";
import { activeEntitlement, countedSlots, narratorSlotCount } from "@/lib/family/permissions";
import { guardianHousehold, isPlanOwner, narratorSlots } from "@/lib/family/service";
import { requireFullSignIn } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Subscription = { id: string; status: string; livemode?: boolean; cancel_at_period_end?: boolean; metadata?: Record<string, string>; items?: { data?: StripeSubItem[] } };

/**
 * Adds or removes one extra storyteller slot on the family's own subscription ({ change: "add" | "remove" }),
 * for the parent who manages the plan. Adding charges the rest of this billing period now; removing
 * needs an empty slot and credits the unused time on the next bill. The new count is saved straight
 * away (the webhook saves the same), and the answer is the updated Family storytellers view.
 */
export async function POST(req: Request) {
  const config = billingConfig();
  if (config.mode === "off") return fail(404, "not_found", "Not found.");
  const { change } = await jsonBody(req);
  if (change !== "add" && change !== "remove") return fail(400, "bad_change", "Choose to add or remove a slot.");
  return withFamily(async ({ store, actor, session }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId || actor.kind !== "adult") return fail(403, "not_guardian", "Only a parent or guardian can change storyteller slots.");
    const state = await store.read();
    if (!isPlanOwner(state, actor.adultId, householdId)) return fail(403, "not_owner", "Only the parent who manages your family's plan can change storyteller slots.");
    await requireFullSignIn(session);
    const db = accountDb();
    if (!db || !session.account) return fail(503, "no_account", "Sign in with a Readli account to change storyteller slots.");

    const entitlement = activeEntitlement(state, householdId);
    if (entitlement?.source !== "subscription") return fail(409, "no_subscription", "Extra storyteller slots go with a paid Readli Family plan.");
    const plan = await effectivePlan(db, store.plan);
    if (change === "add" && !plan.extraSlotPriceApproved) return fail(403, "slots_not_for_sale", "Extra storyteller slots aren't on sale yet.");
    // Only an empty slot can go, so nobody's voice is taken away by a billing change.
    if (change === "remove" && countedSlots(state, householdId, store.plan).length >= narratorSlotCount(state, householdId, store.plan)) {
      return fail(409, "slots_in_use", "Every slot has a storyteller in it. Free one first, then remove the extra slot.");
    }

    const { data: row } = await db
      .from("household_entitlements")
      .select("provider_subscription_ref")
      .eq("household_id", householdId)
      .eq("source", "subscription")
      .eq("status", "active")
      .not("provider_subscription_ref", "is", null)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const subscriptionRef = (row?.provider_subscription_ref as string | undefined) ?? null;
    if (!subscriptionRef) return fail(409, "no_subscription", "We couldn't find your family's subscription. Please contact us.");

    const stripe = new StripeApi(config);
    try {
      const sub = (await stripe.getSubscription(subscriptionRef)) as unknown as Subscription;
      if (sub.metadata?.household_id && sub.metadata.household_id !== householdId) return fail(409, "no_subscription", "We couldn't find your family's subscription. Please contact us.");
      if (change === "add" && sub.cancel_at_period_end) return fail(409, "plan_ending", "Your plan is set to end, so slots can't be added. Turn renewal back on in Manage billing first.");
      const items = sub.items?.data ?? [];
      const needsPrice = change === "add" && subscriptionSlots(items).slotItems.length === 0;
      const price = needsPrice ? await stripe.priceFor(slotItemFor(plan, subscriptionSlots(items).interval)) : null;
      const update = slotUpdate(items, change, price);
      if (!update.ok) return fail(update.status, update.code, update.message);
      const updated = (await stripe.updateSubscription(subscriptionRef, update.params)) as unknown as Subscription;
      await applyBillingChange(
        db,
        billingChange({ type: "customer.subscription.updated", data: { object: { ...updated, metadata: { ...updated.metadata, household_id: householdId } } } }),
        updated.livemode === true,
      );
    } catch (err) {
      if (err instanceof StripeError) {
        return fail(402, "stripe_error", change === "add" ? "The slot couldn't be added. Check your card in Manage billing, then try again." : "The slot couldn't be removed. Please try again.");
      }
      throw err;
    }
    // A fresh read, so the answer shows the new slot count.
    const fresh = new AccountFamilyStore(db, session.account, store.plan);
    return NextResponse.json(await narratorSlots(fresh, actor, householdId));
  });
}

import { NextResponse } from "next/server";
import { checkoutRequest } from "@/lib/billing/checkout";
import { checkoutNotice } from "@/lib/content/billing-policy";
import { accountEmail, loadTrialFacts, trialDecision } from "@/lib/billing/trial";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi, StripeError } from "@/lib/billing/stripe-api";
import { catalogItem } from "@/lib/billing/catalog";
import { effectivePlan } from "@/lib/billing/price-settings";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody, withFamily } from "@/lib/family/http";
import { activeEntitlement } from "@/lib/family/permissions";
import { guardianHousehold } from "@/lib/family/service";
import { rewardsConfig } from "@/lib/rewards/rewards";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Starts a Stripe Checkout for Readli Family ({ item: "family_monthly" | "family_annual", extraSlots }),
 * the Family Archive ({ item: "archive_monthly" }, for a family whose plan ended) or a credit pack
 * ({ item: "credit_pack:<id>" }) and returns its URL. A family eligible for the free trial (see
 * src/lib/billing/trial.ts) starts with it, and checkout always takes a card. Answers 404 while
 * payments are off. Plans and credits are granted from the webhook, never from here.
 */
export async function POST(req: Request) {
  const config = billingConfig();
  if (config.mode === "off") return fail(404, "not_found", "Not found.");
  const body = await jsonBody(req);
  return withFamily(async ({ store, actor, session }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId || actor.kind !== "adult") return fail(403, "not_guardian", "Only a parent or guardian can buy Readli Family or credits.");
    const db = accountDb();
    if (!db || !session.account) return fail(503, "no_account", "Sign in with a Readli account to check out.");

    const state = await store.read();
    const plan = await effectivePlan(db, store.plan);
    const history = state.entitlements.filter((e) => e.householdId === householdId);
    const { data: running, error } = await db
      .from("household_entitlements")
      .select("id")
      .eq("household_id", householdId)
      .eq("status", "active")
      .not("provider_subscription_ref", "is", null)
      .limit(1);
    if (error) throw new Error(`read subscriptions: ${error.message}`);
    const email = await accountEmail(db, actor.adultId);
    const trial = trialDecision(
      await loadTrialFacts(db, { userId: actor.adultId, email: email.email, emailVerified: email.verified, householdId }, rewardsConfig().trialDays),
    );
    const request = checkoutRequest(plan, activeEntitlement(state, householdId), String(body.item ?? ""), body.extraSlots, {
      hadPlan: history.length > 0,
      hasSubscription: (running ?? []).length > 0,
      trialDays: trial.days,
    });
    if (!request.ok) return fail(request.status, request.code, request.message);

    // A plan bought through a family invitation keeps that invitation, if it belongs to this family.
    const asked = typeof body.invitationId === "string" && /^[0-9a-f-]{36}$/i.test(body.invitationId) ? body.invitationId : null;
    const { data: invitation } = asked
      ? await db.from("voice_invitations").select("id").eq("id", asked).eq("household_id", householdId).maybeSingle()
      : { data: null };
    const invitationId = request.mode === "subscription" ? ((invitation?.id as string | undefined) ?? null) : null;
    const { data: customer } = await db.from("billing_customers").select("customer_ref").eq("household_id", householdId).maybeSingle();
    const origin = new URL(req.url).origin;
    const metadata = {
      household_id: householdId,
      adult_id: actor.adultId,
      item: request.mode === "subscription" ? request.plan.id : request.pack.id,
      // The credits paid for, so a later admin change to the packs can't change what this purchase grants.
      ...(request.mode === "payment" ? { credits: String(request.pack.credits ?? 0) } : {}),
      ...(invitationId ? { invitation_id: invitationId } : {}),
    };
    const stripe = new StripeApi(config);
    try {
      const lineItems =
        request.mode === "subscription"
          ? [
              { price: await stripe.priceFor(request.plan), quantity: 1 },
              ...(request.extraSlots ? [{ price: await stripe.priceFor(catalogItem(plan, "extra_slot")!), quantity: request.extraSlots }] : []),
            ]
          : [{ price: await stripe.priceFor(request.pack), quantity: 1 }];
      const checkout = await stripe.createCheckoutSession({
        mode: request.mode,
        line_items: lineItems,
        client_reference_id: householdId,
        customer: customer?.customer_ref ?? undefined,
        customer_email: customer ? undefined : (session.account.email ?? undefined),
        metadata,
        ...(request.mode === "subscription"
          ? {
              // A card is always taken, trial or not, so a trial turns into Readli Family on its own.
              payment_method_collection: "always",
              subscription_data: {
                metadata,
                ...(request.trialDays ? { trial_period_days: request.trialDays, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } } : {}),
              },
            }
          : { payment_intent_data: { metadata } }),
        // The refund and renewal terms, shown above the pay button (Kevin, 2026-10-12: disclosed before purchase).
        custom_text: { submit: { message: checkoutNotice(request.mode, request.mode === "subscription" ? (request.trialDays ?? 0) : 0) } },
        success_url: `${origin}/family/billing?checkout=success`,
        cancel_url: `${origin}/family/billing?checkout=canceled`,
      });
      return NextResponse.json({ url: checkout.url });
    } catch (err) {
      if (err instanceof StripeError) return fail(502, "stripe_error", "Checkout couldn't start. Please try again.");
      throw err;
    }
  });
}

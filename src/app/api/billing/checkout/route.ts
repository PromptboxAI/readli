import { NextResponse } from "next/server";
import { checkoutRequest } from "@/lib/billing/checkout";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi, StripeError } from "@/lib/billing/stripe-api";
import { catalogItem } from "@/lib/billing/catalog";
import { effectivePlan } from "@/lib/billing/price-settings";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody, withFamily } from "@/lib/family/http";
import { activeEntitlement } from "@/lib/family/permissions";
import { guardianHousehold } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Starts a Stripe Checkout for Readli Family ({ item: "family_monthly" | "family_annual", extraSlots })
 * or a credit pack ({ item: "credit_pack:<id>" }) and returns its URL. Answers 404 while payments are
 * off. Plans and credits are granted from the webhook, never from here.
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
    const request = checkoutRequest(plan, activeEntitlement(state, householdId), String(body.item ?? ""), body.extraSlots);
    if (!request.ok) return fail(request.status, request.code, request.message);

    const { data: customer } = await db.from("billing_customers").select("customer_ref").eq("household_id", householdId).maybeSingle();
    const origin = new URL(req.url).origin;
    const metadata = { household_id: householdId, adult_id: actor.adultId, item: request.mode === "subscription" ? request.plan.id : request.pack.id };
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
        ...(request.mode === "subscription" ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
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

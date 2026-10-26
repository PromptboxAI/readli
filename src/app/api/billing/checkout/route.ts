import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { checkoutRequest, checkoutReturn } from "@/lib/billing/checkout";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi, StripeError } from "@/lib/billing/stripe-api";
import { catalogItem } from "@/lib/billing/catalog";
import { effectivePlan } from "@/lib/billing/price-settings";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody, withFamily } from "@/lib/family/http";
import { activeEntitlement } from "@/lib/family/permissions";
import { guardianHousehold } from "@/lib/family/service";
import { requireFullSignIn } from "@/lib/family/session";
import { track } from "@/lib/invitations/server";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Starts a Stripe Checkout for Readli Family ({ item: "family_monthly" | "family_annual", extraSlots })
 * or a credit pack ({ item: "credit_pack:<id>" }) and returns its URL. A Family checkout may name the
 * storyteller invitation (invitationId) that brought the household in, and from: "signup" to come back
 * to setup instead of Plan and billing. With that invitation, returnPath "/v/<token>/connect" comes back
 * to the storyteller's guided steps instead. Answers 404 while payments are off. Plans and credits are granted from the webhook, never from here.
 */
/** The invitation id from the request, only when that invitation was accepted into this household. */
async function acceptedInvitation(db: SupabaseClient, householdId: string, id: unknown): Promise<string | null> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from("voice_invitations").select("id").eq("id", id).eq("household_id", householdId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function POST(req: Request) {
  const config = billingConfig();
  if (config.mode === "off") return fail(404, "not_found", "Not found.");
  const body = await jsonBody(req);
  return withFamily(async ({ store, actor, session }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId || actor.kind !== "adult") return fail(403, "not_guardian", "Only a parent or guardian can buy Readli Family or credits.");
    await requireFullSignIn(session);
    const db = accountDb();
    if (!db || !session.account) return fail(503, "no_account", "Sign in with a Readli account to check out.");

    const state = await store.read();
    const plan = await effectivePlan(db, store.plan);
    const request = checkoutRequest(plan, activeEntitlement(state, householdId), String(body.item ?? ""), body.extraSlots);
    if (!request.ok) return fail(request.status, request.code, request.message);

    const { data: customer } = await db.from("billing_customers").select("customer_ref").eq("household_id", householdId).maybeSingle();
    const origin = new URL(req.url).origin;
    const invitationId = request.mode === "subscription" ? await acceptedInvitation(db, householdId, body.invitationId) : null;
    const metadata = {
      household_id: householdId,
      adult_id: actor.adultId,
      item: request.mode === "subscription" ? request.plan.id : request.pack.id,
      // The credits paid for, so a later admin change to the packs can't change what this purchase grants.
      ...(request.mode === "payment" ? { credits: String(request.pack.credits ?? 0) } : {}),
      // The storyteller invitation that brought this family in, so the webhook credits its payment.
      ...(invitationId ? { invitation_id: invitationId } : {}),
    };
    const fromSignup = request.mode === "subscription" && body.from === "signup";
    const back = checkoutReturn(origin, { fromSignup, invitationId, returnPath: body.returnPath });
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
        success_url: back.success,
        cancel_url: back.cancel,
      });
      if (invitationId) await track(db, "invite_checkout_started", { invitation_id: invitationId, household_id: householdId, item: metadata.item }, actor.adultId);
      return NextResponse.json({ url: checkout.url });
    } catch (err) {
      if (err instanceof StripeError) return fail(502, "stripe_error", "Checkout couldn't start. Please try again.");
      throw err;
    }
  });
}

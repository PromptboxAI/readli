import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/supabase";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi, StripeError } from "@/lib/billing/stripe-api";
import { accountDb } from "@/lib/family/account-store";
import { cartTotalCents, parseGiftCart, PREPAID_PLAN_IDS, type PrepaidPlanId } from "@/lib/gifting/cart";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Starts one Stripe Checkout for several Readli Family gifts and returns its URL. Any signed-in
 * grown-up can give, with or without Readli Family. The gifts are saved as awaiting payment first;
 * the webhook schedules them once paid, and each gets its code only when it's delivered.
 * Answers 404 while payments are off.
 */
export async function POST(req: Request) {
  const config = billingConfig();
  if (config.mode === "off") return fail(404, "not_found", "Not found.");
  const user = await currentUser();
  if (!user) return fail(401, "sign_in_required", "Please sign in to send gifts.");
  const db = accountDb();
  if (!db) return fail(503, "no_account", "Gifts need Readli accounts, which aren't connected here.");

  const parsed = parseGiftCart(await req.json().catch(() => null), new Date().toISOString().slice(0, 10));
  if (!parsed.ok) return fail(400, "bad_cart", parsed.message);
  const { cart } = parsed;

  // Admin-set gift prices (gift_plans) decide what's charged; inactive plans aren't on sale.
  const { data: plans, error } = await db.from("gift_plans").select("id, price_cents, active").in("id", [...PREPAID_PLAN_IDS]);
  if (error) throw new Error(`read gift plans: ${error.message}`);
  const prices: Partial<Record<PrepaidPlanId, number>> = {};
  for (const p of plans ?? []) if (p.active && p.price_cents) prices[p.id as PrepaidPlanId] = p.price_cents as number;
  if (cartTotalCents(cart, prices) === null) return fail(403, "gifts_off", "Gifts aren't on sale yet.");

  const { data: created, error: insertError } = await db
    .from("gifts")
    .insert(
      cart.gifts.map((g) => ({
        giver_id: user.id,
        plan_id: g.plan.id,
        status: "awaiting_payment",
        // Replaced by the real code's hash when the gift is delivered.
        code_hash: `unsent_${randomUUID()}`,
        recipient_name: g.recipientName,
        recipient_email: g.recipientEmail,
        giver_display_name: cart.giverName,
        message: g.message || null,
        deliver_on: g.deliverOn,
      })),
    )
    .select("id");
  if (insertError || !created?.length) throw new Error(`create gifts: ${insertError?.message ?? "nothing created"}`);
  const giftIds = created.map((g) => g.id as string);

  const origin = new URL(req.url).origin;
  const metadata = { item: "gifts", adult_id: user.id, gift_ids: giftIds.join(",") };
  try {
    const checkout = await new StripeApi(config).createCheckoutSession({
      mode: "payment",
      line_items: cart.gifts.map((g) => ({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: prices[g.plan.id]!,
          product_data: { name: `Readli Family gift: ${g.plan.name}, for ${g.recipientName}` },
        },
      })),
      customer_email: user.email ?? undefined,
      metadata,
      payment_intent_data: { metadata },
      success_url: `${origin}/invite/gift/manage?checkout=success`,
      cancel_url: `${origin}/invite/gift/several?checkout=canceled`,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    await db.from("gifts").update({ status: "cancelled" }).in("id", giftIds).eq("status", "awaiting_payment");
    if (err instanceof StripeError) return fail(502, "stripe_error", "Checkout couldn't start. Please try again.");
    throw err;
  }
}

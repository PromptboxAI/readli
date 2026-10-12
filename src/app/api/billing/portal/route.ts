import { NextResponse } from "next/server";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi, StripeError } from "@/lib/billing/stripe-api";
import { accountDb } from "@/lib/family/account-store";
import { withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Opens Stripe's billing page for the household's subscription. Answers 404 while payments are off. */
export async function POST(req: Request) {
  const config = billingConfig();
  if (config.mode === "off") return fail(404, "not_found", "Not found.");
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can manage billing.");
    const db = accountDb();
    if (!db) return fail(503, "no_account", "Sign in with a Readli account to manage billing.");
    const { data: customer } = await db.from("billing_customers").select("customer_ref").eq("household_id", householdId).maybeSingle();
    if (!customer?.customer_ref) return fail(404, "no_billing", "Your family doesn't have a paid plan yet.");
    try {
      const portal = await new StripeApi(config).createPortalSession(customer.customer_ref, `${new URL(req.url).origin}/family/billing`);
      return NextResponse.json({ url: portal.url });
    } catch (err) {
      if (err instanceof StripeError) return fail(502, "stripe_error", "Billing couldn't open. Please try again.");
      throw err;
    }
  });
}

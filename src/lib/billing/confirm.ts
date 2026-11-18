import type { SupabaseClient } from "@supabase/supabase-js";
import { applyBillingChange } from "./apply";
import { billingChange } from "./events";

type StripeObject = Record<string, unknown>;

export type CheckoutOutcome = { status: "done"; item: string; credits: number | null } | { status: "pending" } | { status: "not_found" };

/**
 * Confirms a finished Checkout when the parent lands back on Readli, so their plan or credits show at
 * once instead of waiting on the webhook. It applies the same changes the webhook does, which are safe
 * to repeat, and only for the household that started the checkout.
 */
export async function confirmCheckout(
  db: SupabaseClient,
  getSession: (id: string) => Promise<StripeObject>,
  sessionId: string,
  householdId: string,
): Promise<CheckoutOutcome> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { status: "not_found" };
  const session = await getSession(sessionId);
  const meta = (session.metadata as StripeObject | undefined) ?? {};
  if ((meta.household_id ?? session.client_reference_id) !== householdId) return { status: "not_found" };
  if (session.status !== "complete" || !["paid", "no_payment_required"].includes(String(session.payment_status))) return { status: "pending" };
  const livemode = session.livemode === true;
  await applyBillingChange(db, billingChange({ type: "checkout.session.completed", data: { object: session } }), livemode);
  const subscription = session.subscription;
  if (subscription && typeof subscription === "object") {
    await applyBillingChange(db, billingChange({ type: "customer.subscription.created", data: { object: subscription as StripeObject } }), livemode);
  }
  const item = typeof meta.item === "string" ? meta.item : "";
  const credits = Number(meta.credits);
  return { status: "done", item, credits: Number.isInteger(credits) && credits > 0 ? credits : null };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { queueEmails } from "@/lib/email/outbox";
import { paymentFailedEmail } from "@/lib/email/templates";
import { rows } from "@/lib/lifecycle/db";

/** Queues the "we couldn't take your payment" email for a failed Stripe invoice, once per event. */
export async function queuePaymentFailed(db: SupabaseClient, event: { id: string; data?: { object?: Record<string, unknown> } }, billingUrl: string): Promise<number> {
  const invoice = event.data?.object ?? {};
  const customer = typeof invoice.customer === "string" ? invoice.customer : null;
  if (!customer) return 0;
  const owner = await rows(db.from("billing_customers").select("household_id").eq("customer_ref", customer).limit(1), "read billing customer");
  const householdId = owner[0]?.household_id as string | undefined;
  if (!householdId) return 0;
  const [home, guardians] = await Promise.all([
    rows(db.from("households").select("name").eq("id", householdId), "read family"),
    rows(db.from("household_members").select("user_id").eq("household_id", householdId).eq("role", "guardian").is("removed_at", null), "read guardians"),
  ]);
  const next = typeof invoice.next_payment_attempt === "number" ? new Date(invoice.next_payment_attempt * 1000).toISOString() : null;
  const message = paymentFailedEmail({ familyName: (home[0]?.name as string) || "there", billingUrl, retryAt: next });
  const ids = await queueEmails(
    db,
    guardians.map((g) => ({ dedupeKey: `payment_failed:${event.id}:${g.user_id}`, template: "payment_failed" as const, ...message, to: { userId: g.user_id as string }, householdId })),
  );
  return ids.length;
}

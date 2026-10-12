import type { SupabaseClient } from "@supabase/supabase-js";
import { queueEmails } from "@/lib/email/outbox";
import { paymentFailedEmail, trialEndingEmail } from "@/lib/email/templates";
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

/**
 * The trial reminder (Kevin, 2026-10-12, decision 4), on Stripe's customer.subscription.trial_will_end,
 * which Stripe sends three days before a trial ends. Once per subscription and trial end date, to each
 * guardian. The amount is Stripe's own preview of the first invoice (tax, discounts and account credit
 * included), falling back to the plan's prices when the preview isn't available.
 */
export async function queueTrialReminder(
  db: SupabaseClient,
  event: { type: string; data?: { object?: Record<string, unknown> } },
  billingUrl: string,
  firstInvoiceCents: (customer: string, subscription: string) => Promise<number | null>,
): Promise<number> {
  if (event.type !== "customer.subscription.trial_will_end") return 0;
  const sub = event.data?.object ?? {};
  const id = typeof sub.id === "string" ? sub.id : null;
  const customer = typeof sub.customer === "string" ? sub.customer : null;
  const trialEnd = typeof sub.trial_end === "number" ? sub.trial_end : null;
  if (!id || !customer || !trialEnd || sub.status !== "trialing" || sub.cancel_at_period_end === true) return 0;
  const meta = (sub.metadata as Record<string, unknown> | undefined) ?? {};
  const householdId =
    typeof meta.household_id === "string"
      ? meta.household_id
      : ((await rows(db.from("billing_customers").select("household_id").eq("customer_ref", customer).limit(1), "read billing customer"))[0]?.household_id as string | undefined);
  if (!householdId) return 0;
  const items = ((sub.items as { data?: unknown[] } | undefined)?.data ?? []) as { quantity?: number; price?: { unit_amount?: number; recurring?: { interval?: string } | null } }[];
  const listed = items.reduce((sum, i) => sum + (i.price?.unit_amount ?? 0) * (i.quantity ?? 1), 0);
  const interval = items.some((i) => i.price?.recurring?.interval === "year") ? "year" : "month";
  const amountCents = (await firstInvoiceCents(customer, id).catch(() => null)) ?? listed;
  const [home, guardians] = await Promise.all([
    rows(db.from("households").select("name").eq("id", householdId), "read family"),
    rows(db.from("household_members").select("user_id").eq("household_id", householdId).eq("role", "guardian").is("removed_at", null), "read guardians"),
  ]);
  const trialEndsAt = new Date(trialEnd * 1000).toISOString();
  const message = trialEndingEmail({ familyName: (home[0]?.name as string) || "there", trialEndsAt, amountCents, interval, billingUrl });
  const ids = await queueEmails(
    db,
    guardians.map((g) => ({
      dedupeKey: `trial_ending:${id}:${trialEnd}:${g.user_id}`,
      template: "trial_ending" as const,
      ...message,
      to: { userId: g.user_id as string },
      householdId,
      data: { subscription: id, trial_ends_at: trialEndsAt, amount_cents: amountCents, interval },
    })),
  );
  return ids.length;
}

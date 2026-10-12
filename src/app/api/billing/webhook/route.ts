import { NextResponse } from "next/server";
import { applyBillingChange, recordRevenue } from "@/lib/billing/apply";
import { billingConfig } from "@/lib/billing/config";
import { billingChange } from "@/lib/billing/events";
import { queuePaymentFailed, queueTrialReminder, reviewCreditOnCancel } from "@/lib/billing/notify";
import { revenueRows } from "@/lib/billing/revenue";
import { verifyStripeSignature } from "@/lib/billing/stripe-signature";
import { StripeApi } from "@/lib/billing/stripe-api";
import { accountEmail } from "@/lib/billing/trial";
import { accountDb } from "@/lib/family/account-store";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface StripeEvent {
  id: string;
  type: string;
  livemode: boolean;
  created?: number;
  data?: { object?: Record<string, unknown> };
}

/**
 * Stripe webhook. While payments are off it answers 404 as if it didn't exist. When on, it accepts
 * only correctly signed events whose mode matches ours, stores each event once and applies it once:
 * subscription events start, update or end the household's Readli Family plan, and paid invoices,
 * one-time payments and refunds are recorded for the admin finance report. A failed apply is
 * recorded and answered with a 500, so Stripe retries it.
 */
export async function POST(req: Request) {
  const config = billingConfig();
  if (config.mode === "off" || !config.webhookSecret) return fail(404, "not_found", "Not found.");

  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), config.webhookSecret)) {
    return fail(400, "bad_signature", "Signature check failed.");
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return fail(400, "bad_payload", "Not JSON.");
  }
  if (typeof event?.id !== "string" || typeof event.type !== "string") return fail(400, "bad_payload", "Not a Stripe event.");
  if (event.livemode !== (config.mode === "live")) return fail(400, "wrong_mode", "Event mode doesn't match payments mode.");

  const db = accountDb();
  if (!db) return fail(503, "no_database", "Payments storage isn't configured.");
  const { error } = await db
    .from("payment_events")
    .upsert(
      { provider: "stripe", event_ref: event.id, type: event.type, livemode: event.livemode, payload: event },
      { onConflict: "provider,event_ref", ignoreDuplicates: true },
    );
  // A 5xx makes Stripe retry, which is what we want if storage hiccups.
  if (error) return fail(500, "store_failed", "Couldn't record the event.");
  const { data: stored } = await db.from("payment_events").select("id, processed_at").eq("provider", "stripe").eq("event_ref", event.id).maybeSingle();
  if (!stored) return fail(500, "store_failed", "Couldn't record the event.");
  if (stored.processed_at) return NextResponse.json({ received: true, duplicate: true });

  try {
    const obj = event.data?.object ?? {};
    const stripe = new StripeApi(config);
    await applyBillingChange(db, billingChange(event), event.livemode, undefined, undefined, {
      eventAt: typeof event.created === "number" ? new Date(event.created * 1000).toISOString() : undefined,
      // Who started a trial, and a hash of the card's fingerprint, for the one-trial-per-family check.
      trialStart: async (change) => {
        const adult = typeof (obj.metadata as Record<string, unknown> | undefined)?.adult_id === "string" ? ((obj.metadata as Record<string, string>).adult_id ?? null) : null;
        const pm = typeof obj.default_payment_method === "string" ? obj.default_payment_method : null;
        const fingerprint = pm ? await stripe.cardFingerprint(pm).catch(() => null) : null;
        const email = adult ? await accountEmail(db, adult) : { email: null };
        return { householdId: change.householdId, subscriptionRef: change.subscriptionRef, userId: adult, email: email.email, cardFingerprint: fingerprint };
      },
    });
    await recordRevenue(db, revenueRows(event));
    if (event.type === "invoice.payment_failed") await queuePaymentFailed(db, event, `${new URL(req.url).origin}/family/billing`);
    await reviewCreditOnCancel(db, event, (customer) => stripe.customerBalance(customer));
    await queueTrialReminder(db, event, `${new URL(req.url).origin}/family/billing`, async (customer, subscription) => (await stripe.previewInvoice({ customer, subscription })).amount_due);
  } catch (err) {
    await db.from("payment_events").update({ error: String(err instanceof Error ? err.message : err).slice(0, 500) }).eq("id", stored.id);
    return fail(500, "apply_failed", "Couldn't apply the event.");
  }
  await db.from("payment_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", stored.id);
  return NextResponse.json({ received: true, duplicate: false });
}

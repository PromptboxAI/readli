import { NextResponse } from "next/server";
import { billingConfig } from "@/lib/billing/config";
import { verifyStripeSignature } from "@/lib/billing/stripe-signature";
import { accountDb } from "@/lib/family/account-store";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface StripeEvent {
  id: string;
  type: string;
  livemode: boolean;
}

/**
 * Stripe webhook. While payments are off it answers 404 as if it didn't exist. When on, it accepts
 * only correctly signed events whose mode matches ours, and stores each event once. Turning events
 * into plans and credits comes in a follow-up; nothing here grants anything yet.
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
  const { data, error } = await db
    .from("payment_events")
    .upsert(
      { provider: "stripe", event_ref: event.id, type: event.type, livemode: event.livemode, payload: event },
      { onConflict: "provider,event_ref", ignoreDuplicates: true },
    )
    .select("id");
  // A 5xx makes Stripe retry, which is what we want if storage hiccups.
  if (error) return fail(500, "store_failed", "Couldn't record the event.");
  return NextResponse.json({ received: true, duplicate: !data?.length });
}

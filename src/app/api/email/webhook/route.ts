import { NextResponse } from "next/server";
import { recordEmailEvent } from "@/lib/email/outbox";
import { verifyResendSignature } from "@/lib/email/webhook";
import { accountDb } from "@/lib/family/account-store";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Resend webhook (signed with Svix). Stores each delivery event once and suppresses addresses that
 * hard-bounce or mark Readli as spam. Answers 404 until RESEND_WEBHOOK_SECRET is set.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return fail(404, "not_found", "Not found.");
  const body = await req.text();
  const id = req.headers.get("svix-id");
  const ok = verifyResendSignature(body, { id, timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") }, secret);
  if (!ok || !id) return fail(400, "bad_signature", "Signature check failed.");
  let event: { type?: unknown; data?: unknown };
  try {
    event = JSON.parse(body) as typeof event;
  } catch {
    return fail(400, "bad_payload", "Not JSON.");
  }
  if (typeof event.type !== "string") return fail(400, "bad_payload", "Not a Resend event.");
  const db = accountDb();
  if (!db) return fail(503, "no_database", "Email storage isn't configured.");
  try {
    const result = await recordEmailEvent(db, { id, type: event.type, data: event.data as never });
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    console.error("email webhook failed", err);
    return fail(500, "store_failed", "Couldn't record the event.");
  }
}

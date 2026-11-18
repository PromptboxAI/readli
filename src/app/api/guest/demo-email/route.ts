import { NextResponse } from "next/server";
import { demoEmailOn, looksLikeEmail, requestDemoEmail } from "@/lib/email/guest-demo";
import { deliverEmails, emailSecret, readliMailer } from "@/lib/email/send";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody } from "@/lib/family/http";
import { SITE_URL } from "@/lib/seo/site";
import { currentGuest, guestDemoDeps } from "@/lib/server/guest-demo";
import { fail, NO_SESSION } from "@/lib/server/http";
import { allow } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const MESSAGES = {
  already_sent: "We've already emailed this demo.",
  address_limit: "That address has had a few demos today. Please try again tomorrow.",
  nothing_heard: "Hear a story first, then we can email it to you.",
  expired: NO_SESSION,
} as const;

/** Emails a guest a private link to the demo they just heard. Optional; the demo works without it. */
export async function POST(req: Request) {
  const deps = guestDemoDeps();
  const db = accountDb();
  const secret = emailSecret();
  if (!deps || !db || !secret || !(await demoEmailOn(db, Boolean(secret && readliMailer())))) return fail(503, "off", "Emailing demos isn't available right now.");
  const guest = await currentGuest(deps);
  if (!guest) return fail(401, "no_session", NO_SESSION);
  const { email, deliveryConsent, marketing } = await jsonBody(req);
  if (deliveryConsent !== true) return fail(400, "consent_required", "Tick the box so we can email your demo.");
  if (!looksLikeEmail(email)) return fail(400, "bad_email", "Check the email address and try again.");
  if (!allow(`demo-email:${guest.id}`, 3, 60_000)) return fail(429, "slow_down", "Please wait a minute and try again.");
  const { outcome, outboxId } = await requestDemoEmail(db, secret, SITE_URL, guest, { email, marketing: marketing === true });
  if (outcome !== "queued") return fail(409, outcome, MESSAGES[outcome]);
  if (outboxId) await deliverEmails(db, [outboxId]).catch((err) => console.error("demo email send failed", err));
  return NextResponse.json({ sent: true });
}

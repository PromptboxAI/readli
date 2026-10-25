import { NextResponse } from "next/server";
import { enabledEmails } from "@/lib/email/outbox";
import { emailSecret, deliverEmails } from "@/lib/email/send";
import { scheduleSequenceEmails } from "@/lib/email/sequences";
import { accountDb } from "@/lib/family/account-store";
import { SITE_URL } from "@/lib/seo/site";
import { serverConfig } from "@/lib/server/config";
import { sameHash } from "@/lib/server/guest-token";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Queues the sequence emails now due, then sends due outbox emails. Called hourly by the GitHub Actions email workflow with CRON_SECRET. */
export async function GET(req: Request) {
  const config = serverConfig();
  const auth = req.headers.get("authorization") ?? "";
  if (!config.cronSecret || !sameHash(auth, `Bearer ${config.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = accountDb();
  const secret = emailSecret();
  if (!db || !secret) return NextResponse.json({ skipped: "not configured" });
  const enabled = await enabledEmails(db);
  const scheduled = enabled.size ? await scheduleSequenceEmails({ db, secret, base: SITE_URL, now: new Date(), enabled }) : { queued: 0, errors: [] };
  if (scheduled.errors.length) console.error("email sequences failed", scheduled.errors);
  const report = await deliverEmails(db);
  return NextResponse.json({ scheduled, sent: report ?? { skipped: "email off" } });
}

import { NextResponse } from "next/server";
import { enabledEmails } from "@/lib/email/outbox";
import { emailSecret, deliverEmails } from "@/lib/email/send";
import { queueInvitationReminders, recordReminderDeliveries, type SentReminder } from "@/lib/email/reminders";
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
  const ctx = { db, secret, base: SITE_URL, now: new Date(), enabled };
  const scheduled = enabled.size ? await scheduleSequenceEmails(ctx) : { queued: 0, errors: [] };
  let reminders: SentReminder[] = [];
  try {
    reminders = await queueInvitationReminders(ctx);
  } catch (err) {
    scheduled.errors.push(`I1/I2: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (scheduled.errors.length) console.error("email sequences failed", scheduled.errors);
  // Reminders carry a link made a moment ago, so they go first, before anything else waiting.
  if (reminders.length) await deliverEmails(db, reminders.map((r) => r.outboxId));
  const report = await deliverEmails(db);
  await recordReminderDeliveries(db, reminders).catch((err) => console.error("record reminder delivery failed", err));
  return NextResponse.json({ scheduled: { ...scheduled, reminders: reminders.length }, sent: report ?? { skipped: "email off" } });
}

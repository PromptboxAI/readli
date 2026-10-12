import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { billingConfig } from "@/lib/billing/config";
import { deliverEmails } from "@/lib/email/send";
import { StripeApi } from "@/lib/billing/stripe-api";
import { lifecycleFlags, runLifecycle } from "@/lib/lifecycle/run";
import { serverConfig } from "@/lib/server/config";
import { sameHash } from "@/lib/server/guest-token";
import { accountVoiceDeps, retireUnusedClone } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The daily lifecycle run: recovery windows and their reminder emails, Day-30 household cleanup,
 * recording deletion requests, retiring clones no Readli Family household needs, and sending queued
 * emails through Resend. Vercel Cron calls this with CRON_SECRET. Every destructive step is a dry run
 * unless LIFECYCLE_DELETION=on, LIFECYCLE_CLONE_RETIREMENT=on or LIFECYCLE_RECORDING_DELETION=on;
 * purchased credits and Stripe account credit are only removed at cleanup with LIFECYCLE_CREDIT_FORFEITURE=on.
 */
export async function GET(req: Request) {
  const config = serverConfig();
  const auth = req.headers.get("authorization") ?? "";
  if (!config.cronSecret || !sameHash(auth, `Bearer ${config.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!config.supabaseUrl || !config.supabaseServiceKey) return NextResponse.json({ skipped: "not configured" });
  const db = createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const billing = billingConfig();
  const stripe = billing.mode === "off" ? null : new StripeApi(billing);
  const voices = accountVoiceDeps(config);
  const report = await runLifecycle({
    db,
    ...lifecycleFlags(),
    subscriptionStatuses: stripe ? (customer) => stripe.subscriptionStatuses(customer) : null,
    removeAccountCredit: stripe
      ? async (customer, householdId) => {
          const cents = await stripe.customerCredit(customer);
          if (cents > 0) await stripe.removeCustomerCredit(customer, cents, `closure-credit:${householdId}:${customer}`);
          return cents;
        }
      : null,
    retireClone: voices ? (voiceId) => retireUnusedClone(voices, voiceId) : null,
    billingUrl: `${new URL(req.url).origin}/family/billing`,
    sendEmails: () => deliverEmails(db),
  });
  if (report.errors.length) console.error("lifecycle run errors", report.errors);
  return NextResponse.json(report);
}

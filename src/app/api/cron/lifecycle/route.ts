import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi } from "@/lib/billing/stripe-api";
import { lifecycleFlags, runLifecycle } from "@/lib/lifecycle/run";
import { serverConfig } from "@/lib/server/config";
import { sameHash } from "@/lib/server/guest-token";
import { accountVoiceDeps, retireUnusedClone } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The daily lifecycle run: recovery windows and their reminder emails, Day-30 deletion of stored
 * narration, and retiring clones no Readli Family household needs. Vercel Cron calls this with
 * CRON_SECRET. Deletion and clone retirement are dry runs unless LIFECYCLE_DELETION=on and
 * LIFECYCLE_CLONE_RETIREMENT=on.
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
    retireClone: voices ? (voiceId) => retireUnusedClone(voices, voiceId) : null,
    billingUrl: `${new URL(req.url).origin}/family/billing`,
  });
  if (report.errors.length) console.error("lifecycle run errors", report.errors);
  return NextResponse.json(report);
}

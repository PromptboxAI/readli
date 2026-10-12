import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { queueOpsAlert } from "@/lib/email/ops-alert";
import { cleanupAlert, cleanupExpiredGuests, guestDemoDeps, type CleanupResult } from "@/lib/server/guest-demo";
import { serverConfig } from "@/lib/server/config";
import { sameHash } from "@/lib/server/guest-token";
import { accountVoiceDeps, cleanupStaleCandidates } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Deletes expired guest demos (their recordings, preview audio, provider voices and rows), plus account
 * voice recordings nobody kept or discarded within a day. Vercel Cron calls this three times a day
 * (05:00, 13:00 and 21:00 UTC) with CRON_SECRET. On Hobby a run can start any time in its hour, so an
 * expired demo waits at most about 9 hours: with the 24-hour session, about 33 hours from the start of
 * the demo, leaving room for one failed run inside the public 48-hour promise (guest-cleanup-timing.test).
 * Failures, a backlog or anything past 48 hours emails the admins and returns 500 so the run shows as failed.
 */
export async function GET(req: Request) {
  const config = serverConfig();
  const auth = req.headers.get("authorization") ?? "";
  if (!config.cronSecret || !sameHash(auth, `Bearer ${config.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const effective = config.mode === "off" && config.supabaseUrl ? { ...config, mode: "live" as const } : config;
  const deps = guestDemoDeps(effective);
  const accounts = accountVoiceDeps(effective);
  let candidatesError = false;
  const candidates = accounts ? await cleanupStaleCandidates(accounts).catch((err) => (console.error("candidate cleanup failed", err), (candidatesError = true), null)) : null;
  let guests: CleanupResult | null = null;
  let guestsError: string | null = null;
  if (deps) {
    try {
      guests = await cleanupExpiredGuests(deps);
    } catch (err) {
      guestsError = err instanceof Error ? err.message : String(err);
      console.error("guest cleanup run failed", err);
    }
  }
  const problem = guestsError ? `Demo clean-up failed to run: ${guestsError.slice(0, 300)}` : cleanupAlert(guests, candidates, candidatesError);
  if (problem) {
    console.error("demo cleanup needs attention", problem);
    if (config.supabaseUrl && config.supabaseServiceKey) {
      const db = createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      await queueOpsAlert(db, {
        key: "demo_cleanup",
        subject: "Readli demo clean-up needs attention",
        body: `The demo clean-up reported a problem:\n\n${problem}\n\nReadli promises that demo recordings, demo voices and preview audio are normally deleted within 48 hours. Check the Vercel cron logs for /api/cron/guest-cleanup.`,
      }).catch((err) => console.error("ops alert failed", err));
    }
  }
  const body = { ...(guests ?? { deleted: 0, failed: 0, skipped: deps ? "error" : "not configured" }), candidates, ...(problem ? { alert: problem } : {}) };
  return NextResponse.json(body, { status: problem ? 500 : 200 });
}

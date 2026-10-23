import { NextResponse } from "next/server";
import { cleanupExpiredGuests, guestDemoDeps } from "@/lib/server/guest-demo";
import { serverConfig } from "@/lib/server/config";
import { sameHash } from "@/lib/server/guest-token";
import { accountVoiceDeps, cleanupStaleCandidates } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * TTL deletion of guest audio, provider voices and rows, plus account voice recordings nobody kept
 * or discarded within a day. Called hourly by the GitHub Actions guest-cleanup workflow (and daily by
 * Vercel Cron as a backstop) with CRON_SECRET.
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
  const candidates = accounts ? await cleanupStaleCandidates(accounts).catch((err) => (console.error("candidate cleanup failed", err), null)) : null;
  if (!deps) return NextResponse.json({ deleted: 0, failed: 0, skipped: "not configured", candidates });
  return NextResponse.json({ ...(await cleanupExpiredGuests(deps, 200)), candidates });
}

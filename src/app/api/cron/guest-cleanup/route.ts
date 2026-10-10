import { NextResponse } from "next/server";
import { cleanupExpiredGuests, guestDemoDeps } from "@/lib/server/guest-demo";
import { serverConfig } from "@/lib/server/config";
import { sameHash } from "@/lib/server/guest-token";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** TTL deletion of guest audio, provider voices and rows. Vercel Cron calls this with CRON_SECRET. */
export async function GET(req: Request) {
  const config = serverConfig();
  const auth = req.headers.get("authorization") ?? "";
  if (!config.cronSecret || !sameHash(auth, `Bearer ${config.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const deps = guestDemoDeps(config.mode === "off" && config.supabaseUrl ? { ...config, mode: "live" } : config);
  if (!deps) return NextResponse.json({ deleted: 0, failed: 0, skipped: "not configured" });
  return NextResponse.json(await cleanupExpiredGuests(deps));
}

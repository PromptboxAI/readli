import { NextResponse } from "next/server";
import { serverConfig } from "@/lib/server/config";
import { sameHash } from "@/lib/server/guest-token";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { runSponsorships } from "@/lib/sponsorship/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Delivers gifts whose day has come and keeps families' plans in line with their gifts. Hourly, with CRON_SECRET. */
export async function GET(req: Request) {
  const config = serverConfig();
  const auth = req.headers.get("authorization") ?? "";
  if (!config.cronSecret || !sameHash(auth, `Bearer ${config.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ctx = await sponsorshipContext();
  if (!ctx) return NextResponse.json({ skipped: "sponsorships off" });
  const report = await runSponsorships(ctx);
  if (report.errors.length) console.error("sponsorship run errors", report.errors);
  return NextResponse.json(report, { status: report.errors.length ? 500 : 200 });
}

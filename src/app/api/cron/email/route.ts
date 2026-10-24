import { NextResponse } from "next/server";
import { deliverEmails } from "@/lib/email/send";
import { accountDb } from "@/lib/family/account-store";
import { serverConfig } from "@/lib/server/config";
import { sameHash } from "@/lib/server/guest-token";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sends due outbox emails. Called hourly by the GitHub Actions email workflow with CRON_SECRET. */
export async function GET(req: Request) {
  const config = serverConfig();
  const auth = req.headers.get("authorization") ?? "";
  if (!config.cronSecret || !sameHash(auth, `Bearer ${config.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = accountDb();
  if (!db) return NextResponse.json({ skipped: "not configured" });
  const report = await deliverEmails(db);
  return NextResponse.json(report ?? { skipped: "email off" });
}

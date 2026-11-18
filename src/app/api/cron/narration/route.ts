import { NextResponse } from "next/server";
import { accountDb, AccountFamilyStore } from "@/lib/family/account-store";
import { planConfig } from "@/lib/family/plan";
import { AccountNarrationProvider } from "@/lib/narration/account-provider";
import { SupabaseNarrationStorage } from "@/lib/narration/storage";
import { prepareEveryFamily, type PendingHousehold } from "@/lib/narration/worker";
import { serverConfig } from "@/lib/server/config";
import { sameHash } from "@/lib/server/guest-token";
import { accountVoiceDeps } from "@/lib/voice/account-voices";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const WORK_BUDGET_MS = 270_000;

/**
 * Keeps preparing every family's queued chapters and books when nobody has a book page open (Kevin,
 * 2026-11-08: a chapter sat at 59% for an hour after the tab closed). Called every few minutes by the
 * narration-worker GitHub Actions workflow with CRON_SECRET.
 */
export async function GET(req: Request) {
  const config = serverConfig();
  const auth = req.headers.get("authorization") ?? "";
  if (!config.cronSecret || !sameHash(auth, `Bearer ${config.cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = accountDb();
  const deps = accountVoiceDeps(config);
  if (!db || !deps) return NextResponse.json({ households: 0, skipped: "not configured" });
  const { data, error } = await db
    .from("narration_jobs")
    .select("household_id, requested_by, created_at")
    .in("status", ["queued", "running"])
    .order("created_at")
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const pending: PendingHousehold[] = (data ?? [])
    .filter((j) => typeof j.requested_by === "string" && j.requested_by)
    .map((j) => ({ householdId: j.household_id as string, userId: j.requested_by as string }));
  const audio = new SupabaseNarrationStorage(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const plan = planConfig();
  const result = await prepareEveryFamily(pending, (userId) => new AccountFamilyStore(db, { id: userId, name: "" }, plan, audio), new AccountNarrationProvider(deps), WORK_BUDGET_MS);
  return NextResponse.json({ pending: pending.length, ...result });
}

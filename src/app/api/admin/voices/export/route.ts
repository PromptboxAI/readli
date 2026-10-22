import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/admin/access";
import { loadVoiceMetrics, metricsCsv, toCsv, voicesCsv } from "@/lib/admin/voice-metrics";
import { billingConfig } from "@/lib/billing/config";
import { accountDb } from "@/lib/family/account-store";
import { planConfig } from "@/lib/family/plan";
import { all } from "@/lib/lifecycle/db";

export const dynamic = "force-dynamic";

/** CSV exports for /admin/voices: ?what=metrics (default), voices, or log (the lifecycle audit log). */
export async function GET(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const db = accountDb();
  if (!db) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const what = new URL(req.url).searchParams.get("what") ?? "metrics";
  const at = new Date();
  let csv: string;
  if (what === "log") {
    const log = await all(() => db.from("lifecycle_audit_log").select("id, at, run_id, actor, action, household_id, voice_id, dry_run, detail").order("id"), "read lifecycle log");
    csv = toCsv(
      ["id", "at", "run_id", "actor", "action", "household_id", "voice_id", "dry_run", "detail"],
      log.map((r) => [r.id, r.at, r.run_id, r.actor, r.action, r.household_id, r.voice_id, r.dry_run, JSON.stringify(r.detail ?? {})]),
    );
  } else {
    const report = await loadVoiceMetrics(db, { live: billingConfig().mode === "live", at, cloneRetireAfterDays: planConfig().cloneRetireAfterDays });
    csv = what === "voices" ? voicesCsv(report.voices) : metricsCsv(report.metrics, at);
  }
  const name = `readli-voice-${what === "voices" || what === "log" ? what : "metrics"}-${at.toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });
}

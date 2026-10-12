import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenerationLimits } from "@/lib/family/plan";
import { openException } from "@/lib/lifecycle/cleanup";

/**
 * The spending safeguard across every household (Kevin, 2026-10-12, answer 4): once the last 24 hours
 * of voice-provider usage reach the daily spend or character cap, new narration requests pause and an
 * item opens in the admin exception queue. Preparations already queued finish (their credits are
 * reserved). The totals come from narration_provider_usage, which every generated sentence writes.
 */
export async function spendPause(db: SupabaseClient, limits: GenerationLimits, now = new Date()): Promise<{ code: string; message: string } | null> {
  const since = new Date(now.getTime() - 86_400_000).toISOString();
  const { data, error } = await db.rpc("narration_spend_since", { p_since: since });
  if (error) throw new Error(`read narration spend: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as { usd?: number | string | null; characters?: number | string | null } | null;
  const usd = Number(row?.usd ?? 0);
  const characters = Number(row?.characters ?? 0);
  if (usd < limits.dailySpendUsd && characters < limits.dailyCharactersAllHouseholds) return null;
  await openException(db, {
    kind: "generation_spend_cap",
    reason: `New narration paused: the last 24 hours used $${usd.toFixed(2)} and ${characters.toLocaleString("en-US")} characters (caps $${limits.dailySpendUsd} and ${limits.dailyCharactersAllHouseholds.toLocaleString("en-US")})`,
    detail: { usd, characters, since },
  }).catch((err) => console.error("spend cap exception failed", err));
  return { code: "spend_paused", message: "We've paused new story preparation for a little while. Stories already being prepared will finish. Please try again later." };
}

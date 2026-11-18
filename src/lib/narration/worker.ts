import type { FamilyStore } from "@/lib/family/service";
import type { VoiceProvider } from "@/lib/voice/provider";
import { runPendingJobs } from "./narration";

/** A household with preparation waiting, and a grown-up whose view of the family can see its jobs. */
export interface PendingHousehold {
  householdId: string;
  /** The grown-up who asked for the work (any guardian of the household reads the same jobs). */
  userId: string;
}

/**
 * Background preparation for every family, with nobody's page open. Called on a schedule; each job is
 * leased before it runs, so a worker started by an open book page and this one never prepare the same job.
 * Stops starting new work at the budget; the next run picks up where this one stopped.
 */
export async function prepareEveryFamily(
  pending: PendingHousehold[],
  storeFor: (userId: string) => FamilyStore | null,
  provider: VoiceProvider,
  budgetMs: number,
  clock?: () => Date,
): Promise<{ households: number; failed: string[] }> {
  const deadline = Date.now() + budgetMs;
  const seen = new Set<string>();
  const failed: string[] = [];
  let households = 0;
  for (const p of pending) {
    if (seen.has(p.householdId)) continue;
    const left = deadline - Date.now();
    if (left <= 0) break;
    seen.add(p.householdId);
    const store = storeFor(p.userId);
    if (!store) continue;
    try {
      await runPendingJobs(store, provider, { householdId: p.householdId, budgetMs: left }, clock);
      households += 1;
    } catch (err) {
      // One family's trouble never stops the others; its job is retried on the next run.
      console.error("background narration failed", p.householdId, err);
      failed.push(p.householdId);
    }
  }
  return { households, failed };
}

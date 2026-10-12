import { accountDb } from "@/lib/family/account-store";
import { voiceInUse, type FamilyStore } from "@/lib/family/service";
import { openException } from "@/lib/lifecycle/cleanup";
import { lifecycleFlags } from "@/lib/lifecycle/run";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps, retireUnusedClone } from "./account-voices";

/**
 * Once no family may have new stories made in a voice (sharing off everywhere, or new stories paused),
 * its provider clone has no valid use left and is retired at once (Kevin, 2026-10-12, answer 5). The
 * original recording stays, so sharing or resuming again re-makes it. A failure goes to the admin
 * exception queue rather than blocking the owner's choice, which has already taken effect.
 * Only while LIFECYCLE_CLONE_RETIREMENT=on (Kevin, 2026-10-12: no immediate clone deletion until its
 * launch conditions are met); otherwise the clone is kept and the choice still stops new stories.
 */
export async function retireIfUnused(store: FamilyStore, voiceId: string, signedIn: boolean): Promise<boolean> {
  if (!lifecycleFlags().cloneRetirement) return false;
  if (!signedIn || voiceInUse(await store.read(), voiceId)) return false;
  const deps = accountVoiceDeps(serverConfig());
  if (!deps) return false;
  try {
    return await retireUnusedClone(deps, voiceId);
  } catch (err) {
    console.error("clone retirement failed", err);
    const db = accountDb();
    if (db) {
      await openException(db, { kind: "clone_retirement_failed", voiceId, reason: "The owner stopped all new stories but the voice provider clone couldn't be deleted; retry it", detail: { error: String(err instanceof Error ? err.message : err).slice(0, 300) } }).catch(
        () => undefined,
      );
    }
    return false;
  }
}

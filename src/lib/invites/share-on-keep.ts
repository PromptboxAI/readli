import { accountDb } from "@/lib/family/account-store";
import { DEMO_POLICY_VERSION } from "@/lib/family/demo-family";
import { shareWithJoinedFamilies } from "@/lib/family/service";
import { currentSession, familyStore } from "@/lib/family/session";
import { invitationMailer } from "@/lib/invitations/email";
import { requestOrigin } from "@/lib/invitations/context";
import { emailStorytellerReady } from "./ready";

/**
 * Shares a storyteller's kept voice with the families that invited them, then tells each family's
 * inviting parent by email. Returns how many families it shared with. Never throws: the voice is kept
 * either way, and the storyteller steps still offer to share by hand.
 */
export async function shareKeptVoice(): Promise<number> {
  try {
    const session = await currentSession();
    if (!session?.account || session.actor.kind !== "adult") return 0;
    const store = await familyStore(session);
    if (!store) return 0;
    const shared = await shareWithJoinedFamilies(store, session.actor, DEMO_POLICY_VERSION);
    const db = shared.length ? accountDb() : null;
    if (db) {
      const origin = await requestOrigin();
      for (const { householdId, notice } of shared) {
        await emailStorytellerReady(db, invitationMailer(), origin, { householdId, storytellerId: session.actor.adultId, notice });
      }
    }
    return shared.length;
  } catch (err) {
    console.error("share kept voice failed", err);
    return 0;
  }
}

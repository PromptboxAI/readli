import { accountDb } from "@/lib/family/account-store";
import { guardianHousehold } from "@/lib/family/service";
import { currentSession, familyAccountsEnabled, familyPreviewEnabled, familyStore } from "@/lib/family/session";
import type { FamilyInvite } from "./family-invites";
import { listInvites } from "./server";

export type InviterPage =
  | { mode: "live"; fromName: string; invites: FamilyInvite[] }
  | { mode: "needs_family" }
  | { mode: "sign_in" }
  | { mode: "preview" };

/** Which Invite Family screen to show: saved invitations for a real parent, or the preview. */
export async function inviterPage(): Promise<InviterPage> {
  const session = await currentSession();
  const db = accountDb();
  if (session?.account && db) {
    const store = await familyStore(session);
    const householdId = store ? await guardianHousehold(store, session.actor) : null;
    if (!householdId) return { mode: "needs_family" };
    return { mode: "live", fromName: session.account.name, invites: await listInvites(db, householdId) };
  }
  if (familyAccountsEnabled() && !familyPreviewEnabled()) return { mode: "sign_in" };
  return { mode: "preview" };
}

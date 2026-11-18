import type { FamilyState } from "@/lib/family/model";
import type { InvitationStatus } from "./invitations";

/**
 * Whether a family still has steps left for the invitation it carried in: the storyteller isn't
 * connected yet, or no child in this family can hear them yet. Family home offers "Continue adding
 * [Name]" until then. Another family's invitation, or a closed one, never counts.
 */
export function invitationUnfinished(state: FamilyState, inv: { status: InvitationStatus; householdId: string | null; contributorId: string }, householdId: string): boolean {
  if (inv.status === "pending" || inv.status === "opened") return true;
  if (inv.status !== "accepted" || inv.householdId !== householdId) return false;
  const voices = new Set(state.voices.filter((v) => v.ownerId === inv.contributorId && v.deletedAt === null).map((v) => v.id));
  if (voices.size === 0) return false;
  const kids = new Set(state.children.filter((c) => c.householdId === householdId && c.deletedAt === null).map((c) => c.id));
  return !state.approvals.some((a) => voices.has(a.voiceId) && kids.has(a.childId) && a.revokedAt === null);
}

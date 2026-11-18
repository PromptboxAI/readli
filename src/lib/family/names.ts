import type { Adult, FamilyState } from "./model";

export type CalledAdult = Adult & { relationship: string };

/**
 * A storyteller as one family knows them: their own profile with that family's nickname and relationship
 * label for them. Both come only from their membership in this household, never from another family they
 * belong to. Display only; it never changes who owns the voice or what anyone may do.
 */
export function calledIn(state: FamilyState, adult: Adult | undefined, householdId: string | null | undefined): CalledAdult | undefined {
  if (!adult) return undefined;
  const member = householdId ? state.members.find((m) => m.householdId === householdId && m.adultId === adult.id && m.removedAt === null) : undefined;
  const nickname = member?.nickname?.trim();
  return { ...adult, ...(nickname ? { displayName: nickname } : {}), relationship: member?.relationship?.trim() ?? "" };
}

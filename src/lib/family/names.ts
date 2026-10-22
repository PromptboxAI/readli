import type { Adult, FamilyState } from "./model";

/**
 * A storyteller as one family knows them: their own profile with the family's nickname for them, when
 * the family has set one. Display only; it never changes who owns the voice or what anyone may do.
 */
export function calledIn(state: FamilyState, adult: Adult | undefined, householdId: string | null | undefined): Adult | undefined {
  if (!adult || !householdId) return adult;
  const nickname = state.members.find((m) => m.householdId === householdId && m.adultId === adult.id && m.removedAt === null)?.nickname?.trim();
  return nickname ? { ...adult, displayName: nickname } : adult;
}

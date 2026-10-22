import type { FamilyState } from "./model";

/** Parents of a household see Readli Family. Everyone else with an account is a free storyteller. */
export function isParent(state: FamilyState | null, adultId: string): boolean {
  return Boolean(state?.members.some((m) => m.adultId === adultId && m.role === "guardian" && m.removedAt === null));
}

/** A signed-in adult who reads for families but runs none: they belong on Readli Voice, not in family setup. */
export function isStorytellerOnly(state: FamilyState | null, adultId: string): boolean {
  if (!state || isParent(state, adultId)) return false;
  const member = state.members.some((m) => m.adultId === adultId && m.removedAt === null);
  const voice = state.voices.some((v) => v.ownerId === adultId && v.deletedAt === null);
  return member || voice;
}

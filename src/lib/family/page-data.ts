import { activeChild, isGuardianOf } from "./permissions";
import type { FamilyState } from "./model";
import { currentSession, familyEnabled, familyStore, type FamilySession } from "./session";

/** Session and preview state for server-rendered family pages. */
export async function familyPage(): Promise<
  { enabled: false } | { enabled: true; session: FamilySession | null; state: FamilyState | null }
> {
  if (!familyEnabled()) return { enabled: false };
  const session = await currentSession();
  const store = session ? await familyStore(session) : null;
  return { enabled: true, session, state: store ? await store.read() : null };
}

export function guardianChildren(state: FamilyState, adultId: string) {
  return state.children.filter((c) => activeChild(state, c.id) && isGuardianOf(state, adultId, c.id));
}

import type { familyPage } from "./page-data";
import { homeHousehold } from "./service";

type FamilyPage = Extract<Awaited<ReturnType<typeof familyPage>>, { enabled: true }>;

/** The family this grown-up is a parent in, if any: only parents see Plan & credits and Kids Mode. */
export function settingsHousehold(page: FamilyPage): string | null {
  if (page.session?.actor.kind !== "adult" || !page.state) return null;
  return homeHousehold(page.state, page.session.actor.adultId);
}

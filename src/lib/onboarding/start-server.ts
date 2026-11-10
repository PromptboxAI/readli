import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { chosenName } from "@/lib/account/names";
import { currentAdult } from "@/lib/auth/adult";
import { familyPage } from "@/lib/family/page-data";
import { activeEntitlement } from "@/lib/family/permissions";
import { homeHousehold, PROVISIONAL_FAMILY_NAME } from "@/lib/family/service";
import { familyAccountsEnabled } from "@/lib/family/session";
import { isParent } from "@/lib/family/storyteller";
import { pendingJoinPath } from "@/lib/invites/pending";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";
import { cleanFamilyName, FAMILY_NAME_COOKIE } from "./start";

/** Everything the welcome's pages need about the signed-in grown-up, after sending away anyone it isn't for. */
export interface StartContext {
  userId: string;
  /** Their chosen name, or the one sign-in filled in, to keep or change. */
  name: string | null;
  /** The family name typed in the welcome, or the family they already started. */
  familyName: string | null;
  /** They already look after a family (with no plan yet). */
  parent: boolean;
  voice: "none" | "processing" | "ready";
}

/**
 * The welcome is for a signed-in grown-up without Readli Family. An invitation they were accepting comes
 * first; someone whose family has a plan goes home; and a parent whose family has no plan yet only needs
 * the plan page (`plan` true), since they named their family already.
 */
export async function startContext(here: string, opts: { plan: boolean }): Promise<StartContext> {
  if (!familyAccountsEnabled()) redirect("/signup");
  const user = await currentAdult();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}`);
  const page = await familyPage();
  if (!page.enabled || !page.session || page.session.actor.kind !== "adult") redirect(`/login?next=${encodeURIComponent(here)}`);
  const pending = await pendingJoinPath(user.id);
  if (pending) redirect(pending);
  const state = page.state;
  const parent = isParent(state, user.id);
  const home = parent && state ? homeHousehold(state, user.id) : null;
  if (home && state && activeEntitlement(state, home)) redirect("/family");
  if (parent && !opts.plan) redirect("/start/plan");
  const deps = accountVoiceDeps(serverConfig());
  const voice = deps ? await deps.store.findVoice(user.id).catch(() => null) : null;
  const me = state?.adults.find((a) => a.id === user.id);
  const jar = await cookies();
  const raw = jar.get(FAMILY_NAME_COOKIE)?.value;
  let typed: string | null = null;
  try {
    typed = raw ? cleanFamilyName(decodeURIComponent(raw)) : null;
  } catch {
    typed = null;
  }
  const startedAs = home && state ? (state.households.find((h) => h.id === home)?.name ?? null) : null;
  // Family signup starts a family with a stand-in name until setup asks for the real one.
  const started = startedAs && startedAs !== PROVISIONAL_FAMILY_NAME ? startedAs : null;
  return {
    userId: user.id,
    name: chosenName(me?.displayName ?? user.name, user.email, user.named),
    familyName: started ?? typed,
    parent,
    voice: voice && voice.status !== "deleted" ? voice.status : "none",
  };
}

import { fail } from "@/lib/server/http";
import type { Actor } from "./model";
import { PermissionError, type FamilyStore } from "./service";
import { currentSession, familyPreviewEnabled, familyStore } from "./session";

export const FAMILY_OFF = "Family accounts are coming soon.";

/**
 * Runs a family route as the signed-in actor. Every family and kids route goes through here, so a
 * request with no session, or from the wrong person, gets the same answer whatever the UI shows.
 */
export async function withFamily(
  run: (ctx: { store: FamilyStore; actor: Actor; sandbox: string }) => Promise<Response>,
): Promise<Response> {
  const session = await currentSession();
  if (!session) {
    if (!familyPreviewEnabled()) return fail(404, "family_off", FAMILY_OFF);
    return fail(401, "sign_in_required", "Please sign in as a grown-up to continue.");
  }
  const store = await familyStore(session.sandbox);
  if (!store) return fail(404, "family_off", FAMILY_OFF);
  try {
    return await run({ store, actor: session.actor, sandbox: session.sandbox });
  } catch (err) {
    if (err instanceof PermissionError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
}

export async function jsonBody(req: Request): Promise<Record<string, unknown>> {
  const body = (await req.json().catch(() => null)) as unknown;
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

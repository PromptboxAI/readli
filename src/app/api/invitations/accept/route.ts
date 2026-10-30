import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";
import { invitationContext, requestOrigin } from "@/lib/invitations/context";
import { ACCEPT_MESSAGES, acceptInvitation } from "@/lib/invitations/server";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** A parent connects the inviting storyteller to their family: { token }. No slot or child approval changes. */
export async function POST(req: Request) {
  const { token } = await jsonBody(req);
  const ctx = invitationContext();
  if (!ctx) return fail(404, "invitations_off", "Family invitations aren't switched on here yet.");
  return withFamily(async ({ store, actor, session }) => {
    if (!session.account || actor.kind !== "adult") return fail(403, "not_guardian", ACCEPT_MESSAGES.not_guardian);
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", ACCEPT_MESSAGES.not_guardian);
    const result = await acceptInvitation(ctx.db, String(token ?? ""), actor.adultId, householdId, { mailer: ctx.mailer, origin: await requestOrigin() });
    if (result !== "accepted") return fail(409, result, ACCEPT_MESSAGES[result]);
    // The invitation cookie stays: Family home keeps offering "Continue adding [Name]" until a child can listen.
    return NextResponse.json({ ok: true, householdId });
  });
}

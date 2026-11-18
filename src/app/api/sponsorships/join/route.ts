import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";
import { fail } from "@/lib/server/http";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { ACCEPT_MESSAGES, joinGift } from "@/lib/sponsorship/server";

export const dynamic = "force-dynamic";

/**
 * A parent adds a sponsored gift to their own family: { token }. The sponsor's voice is shared only if
 * they agreed to share it with this family, and no child hears it until a parent approves it.
 */
const message = (code: string) => ACCEPT_MESSAGES[code] ?? "This gift link isn't valid any more.";

export async function POST(req: Request) {
  const { token } = await jsonBody(req);
  const ctx = await sponsorshipContext();
  if (!ctx) return fail(404, "not_found", "This gift isn't available.");
  return withFamily(async ({ store, actor, session }) => {
    if (!session.account || actor.kind !== "adult") return fail(403, "not_guardian", message("not_guardian"));
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", message("not_guardian"));
    const result = await joinGift(ctx, String(token ?? ""), actor.adultId, householdId);
    if (result !== "accepted") return fail(409, result, message(result));
    return NextResponse.json({ ok: true, householdId });
  });
}

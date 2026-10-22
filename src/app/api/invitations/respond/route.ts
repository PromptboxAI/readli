import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withRecipient } from "@/lib/invitations/http";
import { respond } from "@/lib/invitations/server";
import { respondToHouseholdInvite } from "@/lib/invites/email";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Decline, unsubscribe or report: { token, action, reason?, details? }. */
export async function POST(req: Request) {
  const { token, action, reason, details } = await jsonBody(req);
  if (action !== "decline" && action !== "unsubscribe" && action !== "report") return fail(400, "bad_request", "Choose what to do.");
  return withRecipient(req, async ({ db, secret }) => {
    const tok = String(token ?? "");
    // Family storyteller invitations carry an "h." respond token; Readli Voice invitations don't.
    const ok = tok.startsWith("h.") ? await respondToHouseholdInvite(db, secret, tok, action, { reason, details }) : await respond(db, secret, tok, action, { reason, details });
    return ok ? NextResponse.json({ ok }) : fail(404, "not_found", "This link isn't valid.");
  });
}

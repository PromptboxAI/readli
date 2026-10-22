import { withRecipient } from "@/lib/invitations/http";
import { respond } from "@/lib/invitations/server";
import { respondToHouseholdInvite } from "@/lib/invites/email";

export const dynamic = "force-dynamic";

/** One-click unsubscribe from the email's List-Unsubscribe header (RFC 8058). Only POST changes anything. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withRecipient(req, async ({ db, secret }) => {
    const ok = token.startsWith("h.") ? await respondToHouseholdInvite(db, secret, token, "unsubscribe") : await respond(db, secret, token, "unsubscribe");
    return new Response(ok ? "Unsubscribed" : "Not found", { status: ok ? 200 : 404, headers: { "content-type": "text/plain" } });
  });
}

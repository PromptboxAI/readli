import { NextResponse } from "next/server";
import { invitationMailer } from "@/lib/invitations/email";
import { invitationSecret } from "@/lib/invitations/server";
import { EMAIL_MESSAGES, resendInvite } from "@/lib/invites/email";
import { withInviter } from "@/lib/invites/http";
import { allow } from "@/lib/server/rate-limit";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Emails an invitation again with a fresh link, within the same limits as every Readli invitation. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const secret = invitationSecret();
  const mailer = invitationMailer();
  return withInviter(async ({ db, householdId, userId }) => {
    if (!secret || !mailer) return fail(503, "off", EMAIL_MESSAGES.off);
    if (!allow(`family-invite-resend:${userId}`, 5, 60_000)) return fail(429, "slow_down", "That's a lot at once. Please wait a minute and try again.");
    const { link, email } = await resendInvite(db, { secret, origin: new URL(req.url).origin, mailer }, householdId, userId, id);
    if (email !== "sent" && email !== "failed") return fail(409, email, EMAIL_MESSAGES[email]);
    return NextResponse.json({ link, email, message: email === "sent" ? null : EMAIL_MESSAGES.failed });
  });
}

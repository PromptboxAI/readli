import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { invitationMailer } from "@/lib/invitations/email";
import { emailHash, invitationSecret } from "@/lib/invitations/server";
import { emailNewInvite, encryptEmail, inviteEmailOn } from "@/lib/invites/email";
import { withInviter } from "@/lib/invites/http";
import { createInvite, inviteLink, listInvites } from "@/lib/invites/server";
import { allow } from "@/lib/server/rate-limit";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const mailer = invitationMailer();
  return withInviter(async ({ db, householdId }) => {
    const email = await inviteEmailOn(db, mailer);
    return NextResponse.json({ invites: await listInvites(db, householdId, { maxResends: email.on ? email.maxResends : null }) });
  });
}

/**
 * { email?, name?, relationship? }: one of email or name. Returns the link once; only its hash is kept.
 * Where invitation email is switched on, the invitation is also emailed and the address kept encrypted
 * for resends. Otherwise only a keyed hash of the address is kept, and the parent shares the link.
 */
export async function POST(req: Request) {
  const { name, relationship, email } = await jsonBody(req);
  const secret = invitationSecret();
  const mailer = invitationMailer();
  const address = typeof email === "string" ? email.trim() : "";
  return withInviter(async ({ db, householdId, userId }) => {
    if (!allow(`family-invite:${userId}`, 10, 60_000)) return fail(429, "slow_down", "That's a lot at once. Please wait a minute and try again.");
    const sending = address && secret ? await inviteEmailOn(db, mailer) : null;
    const { invite, token } = await createInvite(db, {
      householdId,
      inviterId: userId,
      name: typeof name === "string" ? name : "",
      relationship: typeof relationship === "string" ? relationship : "",
      email: address,
      emailHash: secret && address ? emailHash(secret, address) : null,
      emailEncrypted: secret && sending?.on ? encryptEmail(secret, address) : null,
    });
    const origin = new URL(req.url).origin;
    const emailed = secret && sending?.on ? await emailNewInvite(db, { secret, origin, mailer }, userId, invite.id, token) : "off";
    return NextResponse.json({ invite: { ...invite, emailed: emailed === "sent" }, link: inviteLink(origin, token), email: emailed }, { status: 201 });
  });
}

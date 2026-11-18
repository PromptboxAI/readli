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

/** ?role=guardian lists co-parent invitations; otherwise storyteller invitations. */
export async function GET(req: Request) {
  const mailer = invitationMailer();
  const role = new URL(req.url).searchParams.get("role") === "guardian" ? "guardian" : "member";
  return withInviter(async ({ db, householdId }) => {
    const email = await inviteEmailOn(db, mailer);
    return NextResponse.json({ invites: await listInvites(db, householdId, { maxResends: email.on ? email.maxResends : null, role }) });
  });
}

/**
 * { email?, name?, relationship?, role? }: one of email or name. role "guardian" invites a co-parent, which
 * only the parent who manages the plan can do. Returns the link once; only its hash is kept.
 * Where invitation email is switched on, the invitation is also emailed and the address kept encrypted
 * for resends. Otherwise only a keyed hash of the address is kept, and the parent shares the link.
 */
export async function POST(req: Request) {
  const { name, relationship, email, role } = await jsonBody(req);
  const coParent = role === "guardian";
  const secret = invitationSecret();
  const mailer = invitationMailer();
  const address = typeof email === "string" ? email.trim() : "";
  return withInviter(async ({ db, householdId, userId, owner }) => {
    if (coParent && !owner) return fail(403, "not_owner", "Only the parent who manages your family's plan can invite another parent.");
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
      role: coParent ? "guardian" : "member",
    });
    const origin = new URL(req.url).origin;
    const emailed = secret && sending?.on ? await emailNewInvite(db, { secret, origin, mailer }, userId, invite.id, token) : "off";
    return NextResponse.json({ invite: { ...invite, emailed: emailed === "sent" }, link: inviteLink(origin, token), email: emailed }, { status: 201 });
  });
}

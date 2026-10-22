import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withInviter } from "@/lib/invites/http";
import { emailHash, invitationSecret } from "@/lib/invitations/server";
import { createInvite, inviteLink, listInvites } from "@/lib/invites/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return withInviter(async ({ db, householdId }) => NextResponse.json({ invites: await listInvites(db, householdId) }));
}

/**
 * { email?, name?, relationship? }: one of email or name. Returns the link once; only its hash is kept.
 * Email isn't sent yet, and the address itself isn't stored: only a keyed hash, for suppression later.
 */
export async function POST(req: Request) {
  const { name, relationship, email } = await jsonBody(req);
  const secret = invitationSecret();
  return withInviter(async ({ db, householdId, userId }) => {
    const { invite, token } = await createInvite(db, {
      householdId,
      inviterId: userId,
      name: typeof name === "string" ? name : "",
      relationship: typeof relationship === "string" ? relationship : "",
      email: typeof email === "string" ? email : "",
      emailHash: secret && typeof email === "string" && email.trim() ? emailHash(secret, email) : null,
    });
    return NextResponse.json({ invite, link: inviteLink(new URL(req.url).origin, token) }, { status: 201 });
  });
}

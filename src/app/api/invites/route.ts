import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withInviter } from "@/lib/invites/http";
import { createInvite, inviteLink, listInvites } from "@/lib/invites/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return withInviter(async ({ db, householdId }) => NextResponse.json({ invites: await listInvites(db, householdId) }));
}

/** { name, relationship }. Returns the link once; only its hash is kept. */
export async function POST(req: Request) {
  const { name, relationship } = await jsonBody(req);
  return withInviter(async ({ db, householdId, userId }) => {
    const { invite, token } = await createInvite(db, {
      householdId,
      inviterId: userId,
      name: typeof name === "string" ? name : "",
      relationship: typeof relationship === "string" ? relationship : "",
    });
    return NextResponse.json({ invite, link: inviteLink(new URL(req.url).origin, token) }, { status: 201 });
  });
}

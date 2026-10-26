import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withInviter } from "@/lib/invites/http";
import { revokeInvite, setInviteRelationship } from "@/lib/invites/server";

export const dynamic = "force-dynamic";

/** Withdraws an invitation nobody has accepted yet. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withInviter(async ({ db, householdId }) => {
    await revokeInvite(db, householdId, id);
    return NextResponse.json({ ok: true });
  });
}

/** { relationship }: how the family describes someone it invited. Display only; empty clears it. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { relationship } = await jsonBody(req);
  return withInviter(async ({ db, householdId }) => NextResponse.json({ invite: await setInviteRelationship(db, householdId, id, relationship) }));
}

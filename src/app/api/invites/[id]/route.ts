import { NextResponse } from "next/server";
import { withInviter } from "@/lib/invites/http";
import { revokeInvite } from "@/lib/invites/server";

export const dynamic = "force-dynamic";

/** Withdraws an invitation nobody has accepted yet. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withInviter(async ({ db, householdId }) => {
    await revokeInvite(db, householdId, id);
    return NextResponse.json({ ok: true });
  });
}

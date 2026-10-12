import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { setSession } from "@/lib/family/session";
import { DELETE_CONFIRMATION, deleteAccount, updateDisplayName } from "@/lib/account/privacy";
import { voiceProvider, withAccount } from "@/lib/account/server";
import { providerRefCipher } from "@/lib/server/provider-ref";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Changes the signed-in grown-up's name. */
export async function PATCH(req: Request) {
  const { displayName } = await jsonBody(req);
  return withAccount(async ({ db, user }) => {
    const name = await updateDisplayName(db, user.id, displayName);
    return NextResponse.json({ displayName: name });
  });
}

/** Deletes the signed-in grown-up's account, their voice and the audio made from it, then signs them out. */
export async function DELETE(req: Request) {
  const { confirm } = await jsonBody(req);
  return withAccount(async ({ db, user }) => {
    if (confirm !== DELETE_CONFIRMATION) return fail(400, "confirm_required", `Type ${DELETE_CONFIRMATION} to confirm.`);
    const result = await deleteAccount({ db, provider: voiceProvider(), refs: providerRefCipher() }, user.id);
    if (!result.deleted) {
      return fail(409, "deletion_blocked", "There's something to sort out before your account can be deleted.", { blockers: result.blockers });
    }
    await setSession(null);
    return NextResponse.json(result);
  });
}

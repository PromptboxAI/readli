import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { PermissionError } from "@/lib/family/service";
import { currentSession, requireFullSignIn, setSession } from "@/lib/family/session";
import { DELETE_CONFIRMATION, deleteAccount, updateDisplayName } from "@/lib/account/privacy";
import { deletionBilling, voiceProvider, withAccount } from "@/lib/account/server";
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

/** Deletes the signed-in grown-up's account: stops renewals, deletes their voice and recordings, then signs them out. */
export async function DELETE(req: Request) {
  const { confirm } = await jsonBody(req);
  try {
    await requireFullSignIn(await currentSession());
  } catch (err) {
    if (err instanceof PermissionError) return fail(err.status, err.code, err.userMessage);
    throw err;
  }
  return withAccount(async ({ db, user }) => {
    if (confirm !== DELETE_CONFIRMATION) return fail(400, "confirm_required", `Type ${DELETE_CONFIRMATION} to confirm.`);
    const result = await deleteAccount({ db, provider: voiceProvider(), refs: providerRefCipher(), billing: deletionBilling() }, user.id);
    if (!result.deleted) {
      return fail(409, "deletion_blocked", "There's something to sort out before your account can be deleted.", { blockers: result.blockers });
    }
    await setSession(null);
    return NextResponse.json(result);
  });
}

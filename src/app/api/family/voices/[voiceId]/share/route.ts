import { NextResponse } from "next/server";
import { DEMO_POLICY_VERSION } from "@/lib/family/demo-family";
import { jsonBody, withFamily } from "@/lib/family/http";
import { myVoices, setHouseholdShare } from "@/lib/family/service";
import { requireFullSignIn } from "@/lib/family/session";
import { accountDb } from "@/lib/family/account-store";
import { invitationMailer } from "@/lib/invitations/email";
import { requestOrigin } from "@/lib/invitations/context";
import { emailStorytellerReady } from "@/lib/invites/ready";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** The voice owner shares or stops sharing with one household: { householdId, shared }. Sharing tells the family. */
export async function PUT(req: Request, { params }: { params: Promise<{ voiceId: string }> }) {
  const { voiceId } = await params;
  const { householdId, shared } = await jsonBody(req);
  if (typeof householdId !== "string" || typeof shared !== "boolean") return fail(400, "bad_request", "Choose a family.");
  return withFamily(async ({ store, actor, session }) => {
    await requireFullSignIn(session);
    const notice = await setHouseholdShare(store, actor, { voiceId, householdId, shared, policyVersion: DEMO_POLICY_VERSION });
    // Ready and shared: the parent who invited them hears by email too (once), not only in the app.
    const db = notice && session.account && actor.kind === "adult" ? accountDb() : null;
    if (db && notice && actor.kind === "adult") {
      await emailStorytellerReady(db, invitationMailer(), await requestOrigin(), { householdId, storytellerId: actor.adultId, notice });
    }
    return NextResponse.json({ voices: await myVoices(store, actor) });
  });
}

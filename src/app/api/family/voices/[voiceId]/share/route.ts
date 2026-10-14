import { NextResponse } from "next/server";
import { DEMO_POLICY_VERSION } from "@/lib/family/demo-family";
import { jsonBody, withFamily } from "@/lib/family/http";
import { myVoices, setHouseholdShare } from "@/lib/family/service";
import { requireFullSignIn } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** The voice owner shares or stops sharing with one household: { householdId, shared }. */
export async function PUT(req: Request, { params }: { params: Promise<{ voiceId: string }> }) {
  const { voiceId } = await params;
  const { householdId, shared } = await jsonBody(req);
  if (typeof householdId !== "string" || typeof shared !== "boolean") return fail(400, "bad_request", "Choose a family.");
  return withFamily(async ({ store, actor, session }) => {
    await requireFullSignIn(session);
    await setHouseholdShare(store, actor, { voiceId, householdId, shared, policyVersion: DEMO_POLICY_VERSION });
    return NextResponse.json({ voices: await myVoices(store, actor) });
  });
}

import { NextResponse } from "next/server";
import { DEMO_POLICY_VERSION } from "@/lib/family/demo-family";
import { jsonBody, withFamily } from "@/lib/family/http";
import { myVoices, setHouseholdShare } from "@/lib/family/service";
import { requireFullSignIn } from "@/lib/family/session";
import { fail } from "@/lib/server/http";
import { retireIfUnused } from "@/lib/voice/retire-unused";

export const dynamic = "force-dynamic";

/**
 * The voice owner shares or stops sharing with one household: { householdId, shared }. When no family
 * is left sharing it, the provider clone is retired (the recording stays, so sharing again re-makes it).
 */
export async function PUT(req: Request, { params }: { params: Promise<{ voiceId: string }> }) {
  const { voiceId } = await params;
  const { householdId, shared } = await jsonBody(req);
  if (typeof householdId !== "string" || typeof shared !== "boolean") return fail(400, "bad_request", "Choose a family.");
  return withFamily(async ({ store, actor, session }) => {
    await requireFullSignIn(session);
    await setHouseholdShare(store, actor, { voiceId, householdId, shared, policyVersion: DEMO_POLICY_VERSION });
    if (!shared) await retireIfUnused(store, voiceId, Boolean(session.account));
    return NextResponse.json({ voices: await myVoices(store, actor) });
  });
}

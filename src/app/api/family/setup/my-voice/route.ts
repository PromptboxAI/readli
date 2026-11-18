import { NextResponse } from "next/server";
import { DEMO_POLICY_VERSION } from "@/lib/family/demo-family";
import { withFamily } from "@/lib/family/http";
import { activeShare } from "@/lib/family/permissions";
import { activateNarrator, guardianHousehold, setChildApprovals, setHouseholdShare } from "@/lib/family/service";
import { requireFullSignIn } from "@/lib/family/session";
import { myVoiceForKids } from "@/lib/family/setup";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Setup's one tap for a parent's own voice: share it with their family, put it in a narrator slot, and
 * approve it for every child, so the first book can be read in it straight away.
 */
export async function POST() {
  return withFamily(async ({ store, actor, session }) => {
    if (actor.kind !== "adult") return fail(403, "not_guardian", "Only a parent or guardian can do this.");
    await requireFullSignIn(session);
    const home = await guardianHousehold(store, actor);
    if (!home) return fail(403, "not_guardian", "Only a parent or guardian can do this.");
    const state = await store.read();
    const mine = myVoiceForKids(state, actor.adultId, home, store.plan);
    if (!mine) return fail(409, "voice_not_ready", "Your voice is still being made. Try again in a few minutes.");
    if (!activeShare(state, mine.voiceId, home)) {
      await setHouseholdShare(store, actor, { voiceId: mine.voiceId, householdId: home, shared: true, policyVersion: DEMO_POLICY_VERSION });
    }
    await activateNarrator(store, actor, home, mine.voiceId);
    const kids = (await store.read()).children.filter((c) => c.householdId === home && c.deletedAt === null);
    for (const k of kids) await setChildApprovals(store, actor, k.id, [{ voiceId: mine.voiceId, approved: true }]);
    return NextResponse.json({ on: myVoiceForKids(await store.read(), actor.adultId, home, store.plan)?.on ?? false });
  });
}

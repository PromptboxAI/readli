import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { myVoices, setStorytellerNickname } from "@/lib/family/service";
import { requireFullSignIn } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** A storyteller chooses what one family's children see them as: { householdId, nickname }. */
export async function PUT(req: Request) {
  const { householdId, nickname } = await jsonBody(req);
  if (typeof householdId !== "string" || typeof nickname !== "string") return fail(400, "bad_request", "Choose a family.");
  return withFamily(async ({ store, actor, session }) => {
    await requireFullSignIn(session);
    if (actor?.kind !== "adult") return fail(401, "sign_in", "Sign in to choose your name.");
    await setStorytellerNickname(store, actor, householdId, actor.adultId, nickname);
    return NextResponse.json({ voices: await myVoices(store, actor) });
  });
}

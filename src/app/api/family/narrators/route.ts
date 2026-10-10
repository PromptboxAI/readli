import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { activateNarrator, guardianHousehold, narratorSlots, releaseNarrator } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const noHousehold = () => fail(403, "not_guardian", "Only a parent or guardian can manage narrator slots.");

/** The household's narrator slots: active, shared but not active, and waiting on the owner. */
export async function GET() {
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return noHousehold();
    return NextResponse.json(await narratorSlots(store, actor, householdId));
  });
}

/** { voiceId, action: "activate" | "release" } */
export async function POST(req: Request) {
  const { voiceId, action } = await jsonBody(req);
  if (typeof voiceId !== "string" || (action !== "activate" && action !== "release")) return fail(400, "bad_request", "Choose a storyteller.");
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return noHousehold();
    if (action === "activate") await activateNarrator(store, actor, householdId, voiceId);
    else await releaseNarrator(store, actor, householdId, voiceId);
    return NextResponse.json(await narratorSlots(store, actor, householdId));
  });
}

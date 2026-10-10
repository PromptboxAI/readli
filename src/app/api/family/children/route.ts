import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { childProfiles, createChildProfile, guardianHousehold } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can manage kids profiles.");
    return NextResponse.json(await childProfiles(store, actor, householdId));
  });
}

/** { nickname }. No charge per child, up to the plan's maximum. */
export async function POST(req: Request) {
  const { nickname } = await jsonBody(req);
  if (typeof nickname !== "string") return fail(400, "bad_name", "Give the profile a name.");
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can add kids profiles.");
    await createChildProfile(store, actor, householdId, nickname);
    return NextResponse.json(await childProfiles(store, actor, householdId));
  });
}

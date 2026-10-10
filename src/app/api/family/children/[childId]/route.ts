import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { childProfiles, guardianHousehold, removeChildProfile } from "@/lib/family/service";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  return withFamily(async ({ store, actor }) => {
    await removeChildProfile(store, actor, childId);
    const householdId = (await guardianHousehold(store, actor))!;
    return NextResponse.json(await childProfiles(store, actor, householdId));
  });
}

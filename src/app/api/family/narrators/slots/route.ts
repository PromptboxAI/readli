import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { addNarratorSlot, guardianHousehold, narratorSlots } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Adds one narrator slot. Payments aren't connected yet, so the preview adds it without charging;
 * checkout will call addNarratorSlot only after the charge succeeds.
 */
export async function POST() {
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can add narrator slots.");
    await addNarratorSlot(store, actor, householdId);
    return NextResponse.json(await narratorSlots(store, actor, householdId));
  });
}

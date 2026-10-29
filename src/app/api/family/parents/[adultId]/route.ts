import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { guardianHousehold, removeCoParent } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Takes a co-parent out of the family: the parent who manages the plan removes them, or they leave
 * themselves. Children keep every storyteller that parent approved.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ adultId: string }> }) {
  const { adultId } = await params;
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", "Only a parent in this family can do that.");
    await removeCoParent(store, actor, householdId, adultId);
    return NextResponse.json({ ok: true });
  });
}

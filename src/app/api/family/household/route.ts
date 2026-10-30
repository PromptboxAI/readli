import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { createHousehold, PROVISIONAL_FAMILY_NAME, renameHousehold } from "@/lib/family/service";

export const dynamic = "force-dynamic";

/**
 * Creates the signed-in grown-up's family, or returns the one they already look after. Family signup
 * sends { provisional: true } to go straight on to checkout; setup asks for the name afterwards.
 */
export async function POST(req: Request) {
  const { name, provisional } = await jsonBody(req);
  return withFamily(async ({ store, actor }) => {
    const householdId = await createHousehold(store, actor, provisional === true ? PROVISIONAL_FAMILY_NAME : typeof name === "string" ? name : "");
    return NextResponse.json({ householdId }, { status: 201 });
  });
}

/** Renames the family the signed-in guardian looks after. */
export async function PATCH(req: Request) {
  const { name } = await jsonBody(req);
  return withFamily(async ({ store, actor }) => {
    const saved = await renameHousehold(store, actor, typeof name === "string" ? name : "");
    return NextResponse.json({ name: saved });
  });
}

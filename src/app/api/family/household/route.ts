import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { createHousehold } from "@/lib/family/service";

export const dynamic = "force-dynamic";

/** Creates the signed-in grown-up's family. */
export async function POST(req: Request) {
  const { name } = await jsonBody(req);
  return withFamily(async ({ store, actor }) => {
    const householdId = await createHousehold(store, actor, typeof name === "string" ? name : "");
    return NextResponse.json({ householdId }, { status: 201 });
  });
}

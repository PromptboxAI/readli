import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accountDb, AccountFamilyStore } from "@/lib/family/account-store";
import { jsonBody, withFamily } from "@/lib/family/http";
import { createHousehold, homeHousehold, PROVISIONAL_FAMILY_NAME, renameHousehold } from "@/lib/family/service";
import { acquisitionRow, decodeFirstTouch, FIRST_TOUCH_COOKIE } from "@/lib/marketing/first-touch";

export const dynamic = "force-dynamic";

/**
 * Creates the signed-in grown-up's family, or returns the one they already look after. Family signup
 * sends { provisional: true } to go straight on to checkout; setup asks for the name afterwards. A new
 * family also gets its first-touch acquisition saved once, for the admin growth report.
 */
export async function POST(req: Request) {
  const { name, provisional } = await jsonBody(req);
  return withFamily(async ({ store, actor }) => {
    const existed = actor.kind === "adult" ? homeHousehold(await store.read(), actor.adultId) : null;
    const householdId = await createHousehold(store, actor, provisional === true ? PROVISIONAL_FAMILY_NAME : typeof name === "string" ? name : "");
    if (!existed && store instanceof AccountFamilyStore) await recordAcquisition(householdId);
    return NextResponse.json({ householdId }, { status: 201 });
  });
}

/** Reporting only: a failed write never stops a family being created. */
async function recordAcquisition(householdId: string) {
  const db = accountDb();
  if (!db) return;
  const touch = decodeFirstTouch((await cookies()).get(FIRST_TOUCH_COOKIE)?.value);
  const { error } = await db.from("household_acquisition").upsert(acquisitionRow(householdId, touch), { onConflict: "household_id", ignoreDuplicates: true });
  if (error) console.error("acquisition not recorded", error.message);
}

/** Renames the family the signed-in guardian looks after. */
export async function PATCH(req: Request) {
  const { name } = await jsonBody(req);
  return withFamily(async ({ store, actor }) => {
    const saved = await renameHousehold(store, actor, typeof name === "string" ? name : "");
    return NextResponse.json({ name: saved });
  });
}

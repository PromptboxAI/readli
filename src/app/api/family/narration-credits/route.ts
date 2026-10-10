import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";
import { addNarrationCredits, creditBalance } from "@/lib/narration/narration";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Buy narration minutes: { minutes }. Only when purchases are switched on (payments pending). */
export async function POST(req: Request) {
  const { minutes } = await jsonBody(req);
  return withFamily(async ({ store, actor }) => {
    if (!store.plan.narrationPurchasesEnabled) return fail(403, "purchases_off", "Buying extra narration minutes isn't switched on yet.");
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can buy narration minutes.");
    await addNarrationCredits(store, actor, householdId, Number(minutes));
    return NextResponse.json(creditBalance(await store.read(), store.plan, householdId));
  });
}

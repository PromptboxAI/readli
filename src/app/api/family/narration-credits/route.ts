import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";
import { creditBalance } from "@/lib/narration/credits";
import { creditHistory, purchaseCredits } from "@/lib/narration/narration";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const NOT_GUARDIAN = "Only a parent or guardian can manage Readli credits.";

/** The household's Readli credits: balance by source, renewal, packs and history. */
export async function GET() {
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", NOT_GUARDIAN);
    const state = await store.read();
    return NextResponse.json({
      balance: creditBalance(state, store.plan, householdId),
      packs: store.plan.creditPacks,
      history: creditHistory(state, householdId),
    });
  });
}

/** Buy a credit pack: { packId }. The preview adds credits without payment; real checkout is pending. */
export async function POST(req: Request) {
  const { packId } = await jsonBody(req);
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", NOT_GUARDIAN);
    if (!store.plan.simulatedCheckout) return fail(403, "purchases_off", "Buying Readli credits isn't switched on yet.");
    await purchaseCredits(store, actor, householdId, String(packId ?? ""), { paymentRef: null });
    return NextResponse.json({ balance: creditBalance(await store.read(), store.plan, householdId) });
  });
}

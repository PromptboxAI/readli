import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";

export const dynamic = "force-dynamic";

/** In-app notifications for the family, such as "narration ready". */
export async function GET() {
  return withFamily(async ({ store, actor }) => {
    const householdId = await guardianHousehold(store, actor);
    const state = await store.read();
    const items = householdId ? state.notifications.filter((n) => n.householdId === householdId).slice(-20).reverse() : [];
    return NextResponse.json({ notifications: items }, { headers: { "cache-control": "no-store" } });
  });
}

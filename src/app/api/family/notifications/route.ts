import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { dismissNotices, guardianHousehold } from "@/lib/family/service";

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

/** Dismisses Home's notice for the signed-in grown-up, up to `through` (the newest notice they saw). */
export async function POST(req: Request) {
  return withFamily(async ({ store, actor }) => {
    const { through } = await jsonBody(req);
    await dismissNotices(store, actor, typeof through === "string" ? through : "");
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  });
}

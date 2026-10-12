import { NextResponse } from "next/server";
import { FAMILY_OFF, jsonBody, withFamily } from "@/lib/family/http";
import { setFamilyPin } from "@/lib/family/devices";
import { guardianHousehold } from "@/lib/family/service";
import { deviceRegistry } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Whether the family has a grown-up PIN for leaving Readli Kids. The PIN itself is never returned. */
export async function GET() {
  return withFamily(async ({ actor, store, session }) => {
    const registry = deviceRegistry(Boolean(session.account));
    const householdId = await guardianHousehold(store, actor);
    if (!registry) return fail(404, "family_off", FAMILY_OFF);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can set the PIN.");
    return NextResponse.json({ set: Boolean(await registry.pinHash(householdId)) });
  });
}

/** Sets or changes the family's 4-digit PIN. Kept only as a salted scrypt hash. */
export async function PUT(req: Request) {
  const { pin } = await jsonBody(req);
  return withFamily(async ({ actor, store, session }) => {
    const registry = deviceRegistry(Boolean(session.account));
    const householdId = await guardianHousehold(store, actor);
    if (!registry) return fail(404, "family_off", FAMILY_OFF);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can set the PIN.");
    await setFamilyPin(registry, await store.read(), actor, householdId, pin);
    return NextResponse.json({ ok: true });
  });
}

import { NextResponse } from "next/server";
import { FAMILY_OFF, jsonBody, withFamily } from "@/lib/family/http";
import { listDevices, registerDevice } from "@/lib/family/devices";
import { guardianHousehold } from "@/lib/family/service";
import { deviceRegistry, deviceScope, deviceSecret, startKidsDevice } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** The family's Readli Kids devices, for its parents and guardians. */
export async function GET() {
  return withFamily(async ({ actor, store, session }) => {
    const registry = deviceRegistry(Boolean(session.account));
    if (!registry) return fail(404, "family_off", FAMILY_OFF);
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return fail(403, "not_guardian", "Only a parent or guardian can set up and manage kids devices.");
    return NextResponse.json({ devices: await listDevices(registry, await store.read(), actor, householdId) });
  });
}

/** Sets up this device for the chosen kids. The grown-up is signed out on this device. */
export async function POST(req: Request) {
  const { childIds, label } = await jsonBody(req);
  return withFamily(async ({ actor, store, session }) => {
    const registry = deviceRegistry(Boolean(session.account));
    if (!registry) return fail(404, "family_off", FAMILY_OFF);
    const ids = Array.isArray(childIds) ? childIds.filter((c): c is string => typeof c === "string") : [];
    const { device, token } = await registerDevice(registry, await store.read(), actor, { scope: deviceScope(session), childIds: ids, label }, deviceSecret());
    await startKidsDevice(device, token);
    return NextResponse.json({ ok: true, deviceId: device.id });
  });
}

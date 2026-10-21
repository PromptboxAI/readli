import { NextResponse } from "next/server";
import { FAMILY_OFF, withFamily } from "@/lib/family/http";
import { revokeDevice } from "@/lib/family/devices";
import { deviceRegistry } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Ends a kids device. It loses access on its very next request. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  return withFamily(async ({ actor, store, session }) => {
    const registry = deviceRegistry(Boolean(session.account));
    if (!registry) return fail(404, "family_off", FAMILY_OFF);
    await revokeDevice(registry, await store.read(), actor, deviceId);
    return NextResponse.json({ ok: true });
  });
}

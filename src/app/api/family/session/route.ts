import { NextResponse } from "next/server";
import { jsonBody, withFamily, FAMILY_OFF } from "@/lib/family/http";
import { registerDevice } from "@/lib/family/devices";
import { guardianChildren } from "@/lib/family/page-data";
import { activeChild, isGuardianOf } from "@/lib/family/permissions";
import { currentSession, deviceRegistry, deviceScope, deviceSecret, familyStore, newSandbox, setSession, startKidsDevice } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Who is using this device. "adult:<id>" signs in as a preview family member (preview only; real
 * grown-ups sign in at /login). "child:<id>" turns this device into a Readli Kids device for that
 * child (and their brothers and sisters, who can pick themselves), and needs a signed-in guardian of
 * that child. The grown-up's own sign-in doesn't stay on the device. DELETE signs a grown-up out;
 * a kids device leaves Readli Kids only with the family PIN (/api/kids/device/exit).
 */
export async function POST(req: Request) {
  const { as } = await jsonBody(req);
  const [kind, id] = typeof as === "string" ? as.split(":") : [];
  const existing = await currentSession();
  if (existing?.device && kind === "child") return fail(403, "not_guardian", "Only this child's parent or guardian can open their profile.");
  if (existing?.account && !existing.device) {
    if (kind !== "child" || !id) return fail(400, "bad_request", "Choose a kids profile.");
    return openKids(id);
  }
  const sandbox = existing?.sandbox ?? newSandbox();
  const store = await familyStore(sandbox);
  if (!store) return fail(404, "family_off", FAMILY_OFF);
  const state = await store.read();

  if (kind === "adult" && id && state.adults.some((a) => a.id === id)) {
    await setSession({ sandbox, actor: { kind: "adult", adultId: id } });
    return NextResponse.json({ ok: true });
  }
  if (kind === "child" && id) return openKids(id);
  return fail(400, "bad_request", "Choose who you are.");
}

function openKids(childId: string) {
  return withFamily(async ({ actor, store, session }) => {
    const state = await store.read();
    if (actor.kind !== "adult" || !isGuardianOf(state, actor.adultId, childId)) {
      return fail(403, "not_guardian", "Only this child's parent or guardian can open their profile.");
    }
    const registry = deviceRegistry(Boolean(session.account));
    if (!registry) return fail(404, "family_off", FAMILY_OFF);
    const home = activeChild(state, childId)!.householdId;
    const kids = guardianChildren(state, actor.adultId).filter((c) => c.householdId === home).map((c) => c.id);
    const { device, token } = await registerDevice(
      registry,
      state,
      actor,
      { scope: deviceScope(session), childIds: kids, activeChildId: childId, label: "This device" },
      deviceSecret(),
    );
    await startKidsDevice(device, token);
    return NextResponse.json({ ok: true, deviceId: device.id });
  });
}

export async function DELETE() {
  const session = await currentSession();
  if (session?.device) return fail(403, "pin_required", "A grown-up's PIN is needed to leave Readli Kids.");
  await setSession(null);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { jsonBody, withFamily, FAMILY_OFF } from "@/lib/family/http";
import { activeChild, isGuardianOf } from "@/lib/family/permissions";
import { currentSession, familyStore, newSandbox, setSession, startTemporaryKids } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Who is using this browser. "adult:<id>" signs in as a preview family member (preview only; real
 * grown-ups sign in at /login). "child:<id>" opens temporary Kids Mode for that child on this browser
 * only, and needs a signed-in guardian of that child; it ends when a grown-up signs back in. Dedicated
 * kids devices are set up separately (/api/family/devices) and leave with the family PIN.
 */
export async function POST(req: Request) {
  const { as } = await jsonBody(req);
  const [kind, id] = typeof as === "string" ? as.split(":") : [];
  const existing = await currentSession();
  if ((existing?.device || existing?.temporary) && kind === "child") return fail(403, "not_guardian", "Only this child's parent or guardian can open their profile.");
  if (existing?.account && !existing.device && !existing.temporary) {
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
    if (actor.kind !== "adult" || !isGuardianOf(state, actor.adultId, childId) || !activeChild(state, childId)) {
      return fail(403, "not_guardian", "Only this child's parent or guardian can open their profile.");
    }
    // Temporary Kids Mode on this browser only. Dedicated kids devices are set up at /family/devices.
    await startTemporaryKids(session, childId);
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE() {
  const session = await currentSession();
  if (session?.device) return fail(403, "pin_required", "A grown-up's PIN is needed to leave Readli Kids.");
  await setSession(null);
  return NextResponse.json({ ok: true });
}

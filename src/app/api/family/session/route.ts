import { NextResponse } from "next/server";
import { jsonBody, withFamily, FAMILY_OFF } from "@/lib/family/http";
import { isGuardianOf } from "@/lib/family/permissions";
import { currentSession, familyStore, newSandbox, setSession } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Who is using this device. "adult:<id>" signs in as a preview family member (preview only; real
 * grown-ups sign in at /login). "child:<id>" opens a Readli Kids profile and needs a signed-in
 * guardian of that child, so a child can never open a profile, or get back to the grown-up side, on
 * their own. DELETE signs out, including a real account.
 */
export async function POST(req: Request) {
  const { as } = await jsonBody(req);
  const [kind, id] = typeof as === "string" ? as.split(":") : [];
  const existing = await currentSession();
  if (existing?.account) {
    if (kind !== "child" || !id) return fail(400, "bad_request", "Choose a kids profile.");
    return withFamily(async ({ actor, store, session }) => {
      if (actor.kind !== "adult" || !isGuardianOf(await store.read(), actor.adultId, id)) {
        return fail(403, "not_guardian", "Only this child's parent or guardian can open their profile.");
      }
      await setSession({ ...session, actor: { kind: "child", childId: id } });
      return NextResponse.json({ ok: true });
    });
  }
  const sandbox = existing?.sandbox ?? newSandbox();
  const store = await familyStore(sandbox);
  if (!store) return fail(404, "family_off", FAMILY_OFF);
  const state = await store.read();

  if (kind === "adult" && id && state.adults.some((a) => a.id === id)) {
    await setSession({ sandbox, actor: { kind: "adult", adultId: id } });
    return NextResponse.json({ ok: true });
  }
  if (kind === "child" && id) {
    return withFamily(async ({ actor }) => {
      if (actor.kind !== "adult" || !isGuardianOf(state, actor.adultId, id)) {
        return fail(403, "not_guardian", "Only this child's parent or guardian can open their profile.");
      }
      await setSession({ sandbox, actor: { kind: "child", childId: id } });
      return NextResponse.json({ ok: true });
    });
  }
  return fail(400, "bad_request", "Choose who you are.");
}

export async function DELETE() {
  await setSession(null);
  return NextResponse.json({ ok: true });
}

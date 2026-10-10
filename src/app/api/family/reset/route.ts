import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { resetSandbox } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Puts this visitor's preview family back to how it started. Grown-ups only. */
export async function POST() {
  return withFamily(async ({ actor, sandbox }) => {
    if (actor.kind !== "adult") return fail(403, "adults_only", "Ask a grown-up to do this.");
    resetSandbox(sandbox);
    return NextResponse.json({ ok: true });
  });
}

import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { PermissionError } from "@/lib/family/service";
import { currentSession, resumeGrownUp } from "@/lib/family/session";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Leaves temporary Kids Mode on a grown-up's own browser with the family PIN: { pin }. */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session?.temporary) return fail(409, "not_temporary", "This browser isn't in temporary Kids Mode.");
  const { pin } = await jsonBody(req);
  try {
    await resumeGrownUp(session, pin);
  } catch (err) {
    if (err instanceof PermissionError) return fail(err.status, err.code, err.userMessage, err.details);
    throw err;
  }
  return NextResponse.json({ ok: true });
}

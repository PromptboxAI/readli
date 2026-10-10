import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { narratorsFor } from "@/lib/family/service";

export const dynamic = "force-dynamic";

/** Only the narrators this child may hear right now: owner shared and guardian approved. */
export async function GET(_req: Request, { params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  return withFamily(async ({ store, actor }) =>
    NextResponse.json({ narrators: await narratorsFor(store, actor, childId) }, { headers: { "cache-control": "no-store" } }),
  );
}

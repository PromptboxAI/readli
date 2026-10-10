import { NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { manageStorytellers, setChildApprovals } from "@/lib/family/service";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ childId: string }> };

/** Manage Storytellers: every voice in the household and its state for this child. Guardians only. */
export async function GET(_req: Request, { params }: Params) {
  const { childId } = await params;
  return withFamily(async ({ store, actor }) => NextResponse.json(await manageStorytellers(store, actor, childId)));
}

/** Approve or remove voices for this child: { changes: [{ voiceId, approved }] }. Guardians only. */
export async function PUT(req: Request, { params }: Params) {
  const { childId } = await params;
  const { changes } = await jsonBody(req);
  const valid =
    Array.isArray(changes) &&
    changes.length > 0 &&
    changes.length <= 50 &&
    changes.every((c) => c && typeof c.voiceId === "string" && typeof c.approved === "boolean");
  if (!valid) return fail(400, "bad_request", "Choose at least one storyteller.");
  return withFamily(async ({ store, actor }) => {
    await setChildApprovals(store, actor, childId, changes as { voiceId: string; approved: boolean }[]);
    return NextResponse.json(await manageStorytellers(store, actor, childId));
  });
}

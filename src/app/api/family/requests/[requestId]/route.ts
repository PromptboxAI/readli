import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { dismissStoryRequest } from "@/lib/family/service";

export const dynamic = "force-dynamic";

/** A parent or guardian clears a child's story request from Family Home. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return withFamily(async ({ store, actor }) => {
    await dismissStoryRequest(store, actor, requestId);
    return NextResponse.json({ ok: true });
  });
}

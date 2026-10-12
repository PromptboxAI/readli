import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withContributor } from "@/lib/invitations/http";
import { approvePreview } from "@/lib/invitations/server";

export const dynamic = "force-dynamic";

/** The contributor approves their draft preview: { previewId }. */
export async function POST(req: Request) {
  const { previewId } = await jsonBody(req);
  return withContributor(async (ctx, user) => NextResponse.json({ preview: await approvePreview(ctx.db, ctx.deps, user.id, String(previewId ?? "")) }));
}

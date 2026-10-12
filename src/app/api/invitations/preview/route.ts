import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withContributor } from "@/lib/invitations/http";
import { generatePreview } from "@/lib/invitations/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Reads the chosen passage in the contributor's voice: { passageId }. */
export async function POST(req: Request) {
  const { passageId } = await jsonBody(req);
  return withContributor(async (ctx, user) => NextResponse.json({ preview: await generatePreview(ctx.db, ctx.deps, user.id, String(passageId ?? "")) }), { key: "invite-preview", limit: 3 });
}

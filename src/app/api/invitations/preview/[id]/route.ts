import { NextResponse } from "next/server";
import { withContributor } from "@/lib/invitations/http";
import { ownPreviewAudioUrl } from "@/lib/invitations/server";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** A short-lived link to one of the contributor's own previews, so they can hear it before approving. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withContributor(async (ctx, user) => {
    const url = await ownPreviewAudioUrl(ctx.db, user.id, id);
    return url ? NextResponse.json({ url }, { headers: { "cache-control": "no-store" } }) : fail(404, "no_preview", "That preview isn't available any more.");
  });
}

import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withRecipient } from "@/lib/invitations/http";
import { playPreview } from "@/lib/invitations/server";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** The recipient pressed play: returns a short-lived link to the approved preview. */
export async function POST(req: Request) {
  const { token } = await jsonBody(req);
  return withRecipient(req, async ({ db }) => {
    const url = await playPreview(db, String(token ?? ""));
    return url ? NextResponse.json({ url }, { headers: { "cache-control": "no-store" } }) : fail(404, "not_found", "This preview isn't available any more.");
  });
}

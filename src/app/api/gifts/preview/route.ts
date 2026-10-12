import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withRecipient } from "@/lib/invitations/http";
import { playGiftPreview } from "@/lib/invitations/server";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** A gift's recipient pressed play on the giver's voice preview: { code }. */
export async function POST(req: Request) {
  const { code } = await jsonBody(req);
  return withRecipient(req, async ({ db }) => {
    const url = await playGiftPreview(db, String(code ?? ""));
    return url ? NextResponse.json({ url }, { headers: { "cache-control": "no-store" } }) : fail(404, "not_found", "This preview isn't available any more.");
  });
}

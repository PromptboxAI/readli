import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withRecipient } from "@/lib/invitations/http";
import { markOpened } from "@/lib/invitations/server";

export const dynamic = "force-dynamic";

/** Sent by the preview page's script once it is on screen. Link scanners that only fetch the page never send it. */
export async function POST(req: Request) {
  const { token } = await jsonBody(req);
  return withRecipient(req, async ({ db }) => NextResponse.json({ ok: await markOpened(db, String(token ?? "")) }));
}

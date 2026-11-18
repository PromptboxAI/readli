import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withRecipient } from "@/lib/invitations/http";
import { recipientEvent } from "@/lib/invitations/server";

export const dynamic = "force-dynamic";

/** The invitation page's own events: { token, event: "audio_completed" | "family_cta" | "connect_cta" }. */
export async function POST(req: Request) {
  const { token, event } = await jsonBody(req);
  return withRecipient(req, async ({ db }) => NextResponse.json({ ok: await recipientEvent(db, String(token ?? ""), String(event ?? "")) }));
}

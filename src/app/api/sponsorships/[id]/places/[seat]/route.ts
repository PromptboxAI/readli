import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { fail } from "@/lib/server/http";
import { withSponsorship } from "@/lib/sponsorship/http";
import { offerPlace, removeFamily, undoRemoval } from "@/lib/sponsorship/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * One of the gift's two places. { action: "remove", confirmed: true } schedules a removal for the end of
 * the gift month; { action: "undo" } takes it back; { action: "offer", name, email, shareVoice } invites
 * another family to a free place.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; seat: string }> }) {
  const { id, seat } = await params;
  const place = Number(seat);
  const body = await jsonBody(req);
  return withSponsorship(async (ctx, user) => {
    if (body.action === "remove") {
      const { accessUntil } = await removeFamily(ctx, user.id, id, place, body.confirmed === true);
      return NextResponse.json({ accessUntil: accessUntil.toISOString() });
    }
    if (body.action === "undo") {
      await undoRemoval(ctx, user.id, id, place);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "offer") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim();
      if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, "bad_recipient", "Add the family's name and email address.");
      await offerPlace(ctx, user.id, id, place, { name, email, shareVoice: body.shareVoice === true });
      return NextResponse.json({ ok: true });
    }
    return fail(400, "bad_action", "Choose remove, undo or offer.");
  });
}

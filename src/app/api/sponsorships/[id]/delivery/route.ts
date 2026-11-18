import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withSponsorship } from "@/lib/sponsorship/http";
import { changeDelivery } from "@/lib/sponsorship/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Moves the delivery day before the gift arrives: { deliverOn: "now" | "YYYY-MM-DD", timeZone }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await jsonBody(req);
  return withSponsorship(async (ctx, user) => NextResponse.json({ deliverAt: (await changeDelivery(ctx, user.id, id, body.deliverOn, body.timeZone)).toISOString() }));
}

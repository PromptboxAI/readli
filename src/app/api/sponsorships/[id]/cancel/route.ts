import { NextResponse } from "next/server";
import { withSponsorship } from "@/lib/sponsorship/http";
import { cancelGift } from "@/lib/sponsorship/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Cancels the sponsor's gift: a full refund before it arrives, or no more monthly renewals after. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withSponsorship(async (ctx, user) => NextResponse.json({ outcome: await cancelGift(ctx, user.id, id) }));
}

import { NextResponse } from "next/server";
import { withSponsorship } from "@/lib/sponsorship/http";
import { cancelGift, refundGift } from "@/lib/sponsorship/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cancels the sponsor's gift: a full refund before it arrives, or no more monthly renewals after.
 * With `{ refund: true }` after it arrives, refunds it and ends it for both families now.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { refund?: unknown };
  return withSponsorship(async (ctx, user) =>
    NextResponse.json(body.refund === true ? { refunded: await refundGift(ctx, user.id, id) } : { outcome: await cancelGift(ctx, user.id, id) }),
  );
}

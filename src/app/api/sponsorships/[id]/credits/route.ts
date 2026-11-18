import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withSponsorship } from "@/lib/sponsorship/http";
import { rebalanceCredits } from "@/lib/sponsorship/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A new credit split between the families, from the next gift month: { shares: { "1": 25, "2": 15 } }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await jsonBody(req);
  const shares = (body.shares && typeof body.shares === "object" ? body.shares : {}) as Record<number, unknown>;
  return withSponsorship(async (ctx, user) => {
    const { from } = await rebalanceCredits(ctx, user.id, id, shares);
    return NextResponse.json({ from: from?.toISOString() ?? null });
  });
}

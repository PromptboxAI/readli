import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { withSponsorship } from "@/lib/sponsorship/http";
import { giveRequest } from "@/lib/sponsorship/rules";
import { startGift } from "@/lib/sponsorship/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Starts a sponsored Readli Family gift and returns Stripe Checkout's URL: { plan: "annual" | "monthly",
 * deliverOn: "now" | "YYYY-MM-DD", timeZone, giverName, message, recipients: [{ name, email, shareVoice }],
 * voiceConsent }. The gift is paid now and arrives on its day; nothing is granted until Stripe confirms.
 */
export async function POST(req: Request) {
  const body = await jsonBody(req);
  return withSponsorship(async (ctx, user) => {
    const started = await startGift(ctx, user, giveRequest(body));
    return NextResponse.json(started);
  }, { newGifts: true });
}

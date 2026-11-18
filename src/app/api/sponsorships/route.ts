import { NextResponse } from "next/server";
import { IN_APP_PURCHASE_MESSAGE, fromAndroidApp } from "@/lib/android/in-app";
import { jsonBody } from "@/lib/family/http";
import { withSponsorship } from "@/lib/sponsorship/http";
import { giveRequest } from "@/lib/sponsorship/rules";
import { startGift } from "@/lib/sponsorship/server";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Starts a sponsored Readli Family gift and returns Stripe Checkout's URL: { plan: "annual" | "monthly",
 * deliverOn: "now" | "YYYY-MM-DD", timeZone, giverName, message, recipients: [{ name, email, shareVoice }],
 * voiceConsent }. The gift is paid now and arrives on its day; nothing is granted until Stripe confirms.
 */
export async function POST(req: Request) {
  if (fromAndroidApp(req)) return fail(403, "in_app_purchase", IN_APP_PURCHASE_MESSAGE);
  const body = await jsonBody(req);
  return withSponsorship(async (ctx, user) => {
    const started = await startGift(ctx, user, giveRequest(body));
    return NextResponse.json(started);
  }, { newGifts: true });
}

import { NextResponse } from "next/server";
import { currentAdult } from "@/lib/auth/adult";
import { safeNext } from "@/lib/auth/supabase";
import { VOICE_SETUP_LATER_COOKIE } from "@/lib/family/setup-cookie";
import { START_CHOSE_VOICE_COOKIE } from "@/lib/onboarding/start";
import { accountDb } from "@/lib/family/account-store";
import { readVoiceHomeProgress } from "@/lib/voice/home-progress";

export const dynamic = "force-dynamic";

/**
 * "Keep my free account": stays on Readli Voice, so Home and My Voice stop sending them back into setup. The
 * first time, they see the Voice welcome (who should hear you?); after that, Voice Home.
 *
 * With ?next=, it's the free Readli Voice signup from /try: the account is marked as Readli Voice and goes
 * straight on to keep its voice. Without the mark, Home would treat an account with no voice yet as someone
 * new and send them into the family welcome (Kevin, 2026-11-16).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secure = url.protocol === "https:";
  // Remembered for this account only, so another account on the same browser still gets the welcome.
  const user = await currentAdult().catch(() => null);
  const next = safeNext(url.searchParams.get("next"), "");
  if (!user) return NextResponse.redirect(new URL(next || "/home", req.url));
  if (next) {
    const res = NextResponse.redirect(new URL(next, req.url));
    res.cookies.set(START_CHOSE_VOICE_COOKIE, user.id, { path: "/", sameSite: "lax", httpOnly: true, secure, maxAge: 60 * 60 * 24 * 365 });
    return res;
  }
  const welcomed = Boolean((await readVoiceHomeProgress(accountDb(), user.id)).welcomedAt);
  const res = NextResponse.redirect(new URL(welcomed ? "/home" : "/home/welcome", req.url));
  res.cookies.set(START_CHOSE_VOICE_COOKIE, user.id, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure,
    maxAge: 60 * 60 * 24 * 365,
  });
  res.cookies.set(VOICE_SETUP_LATER_COOKIE, user.id, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure,
  });
  return res;
}

import { NextResponse } from "next/server";
import { currentAdult } from "@/lib/auth/adult";
import { VOICE_SETUP_LATER_COOKIE } from "@/lib/family/setup-cookie";
import { START_CHOSE_VOICE_COOKIE } from "@/lib/onboarding/start";

export const dynamic = "force-dynamic";

/** "Keep my free account": stays on Readli Voice, so Family Home and My Voice stop sending them back into setup. */
export async function GET(req: Request) {
  const secure = new URL(req.url).protocol === "https:";
  const res = NextResponse.redirect(new URL("/voice", req.url));
  // Remembered for this account only, so another account on the same browser still gets the welcome.
  const user = await currentAdult().catch(() => null);
  if (!user) return res;
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

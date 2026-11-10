import { NextResponse } from "next/server";
import { VOICE_SETUP_LATER_COOKIE } from "@/lib/family/setup-cookie";
import { START_CHOSE_VOICE_COOKIE } from "@/lib/onboarding/start";

export const dynamic = "force-dynamic";

/** "Keep my free account": stays on Readli Voice, so Family Home and My Voice stop sending them back into setup. */
export function GET(req: Request) {
  const secure = new URL(req.url).protocol === "https:";
  const res = NextResponse.redirect(new URL("/voice", req.url));
  res.cookies.set(START_CHOSE_VOICE_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure,
    maxAge: 60 * 60 * 24 * 365,
  });
  res.cookies.set(VOICE_SETUP_LATER_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure,
  });
  return res;
}

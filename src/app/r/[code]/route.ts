import { NextResponse } from "next/server";
import { rewardsVisible } from "@/lib/rewards/rewards";
import { normalizeReferralCode, REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from "@/lib/rewards/server";

/** A referral link. Remembers the code for sign-up while the rewards program is visible; otherwise just goes home. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeReferralCode((await params).code);
  if (!rewardsVisible() || !code) return NextResponse.redirect(new URL("/", req.url));
  const res = NextResponse.redirect(new URL("/signup", req.url));
  res.cookies.set(REFERRAL_COOKIE, code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: REFERRAL_COOKIE_DAYS * 86_400 });
  return res;
}

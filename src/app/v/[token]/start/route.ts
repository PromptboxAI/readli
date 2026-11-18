import { NextResponse } from "next/server";
import { INVITE_COOKIE } from "@/lib/invitations/server";

export const dynamic = "force-dynamic";

/**
 * "Start Readli Family" and "Connect [Name] to My Family": remembers the invitation through sign-in,
 * checkout and an interrupted signup, then continues to the connect page, which walks the family
 * through each step. Both buttons are the recipient choosing to add the storyteller, so the
 * connect page adds them without asking again.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return NextResponse.redirect(new URL("/", req.url));
  const billing = new URL(req.url).searchParams.get("billing") === "annual" ? "annual" : "monthly";
  const res = NextResponse.redirect(new URL(`/v/${token}/connect?billing=${billing}&connect=1`, req.url));
  res.cookies.set(INVITE_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 14 * 86_400 });
  return res;
}

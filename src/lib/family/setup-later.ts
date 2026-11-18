import { NextResponse } from "next/server";
import { currentAdult } from "@/lib/auth/adult";

/**
 * Leaves setup for now: remembers that for this browser session (a session cookie) and this account only, then
 * goes on to `to`.
 */
export async function leaveSetup(req: Request, cookie: string, to: string): Promise<NextResponse> {
  const res = NextResponse.redirect(new URL(to, req.url));
  const user = await currentAdult().catch(() => null);
  if (user) res.cookies.set(cookie, user.id, { path: "/", sameSite: "lax", httpOnly: true, secure: new URL(req.url).protocol === "https:" });
  return res;
}

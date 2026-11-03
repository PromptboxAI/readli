import { NextResponse } from "next/server";

/** Leaves setup for now: remembers that for this browser session (a session cookie), then goes on to `to`. */
export function leaveSetup(req: Request, cookie: string, to: string): NextResponse {
  const res = NextResponse.redirect(new URL(to, req.url));
  res.cookies.set(cookie, "1", { path: "/", sameSite: "lax", httpOnly: true, secure: new URL(req.url).protocol === "https:" });
  return res;
}

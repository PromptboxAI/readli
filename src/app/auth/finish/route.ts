import { NextResponse } from "next/server";
import { clearSignInCookies, finishSignIn } from "@/lib/auth/finish-sign-in";
import { authConfigured, safeNext, supabaseServer } from "@/lib/auth/supabase";
import { jsonBody } from "@/lib/family/http";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * POST: finishes a sign-in made with the emailed code on the page itself (the browser already holds the
 * session), the same way the email link's callback does, and says where to go next.
 */
export async function POST(req: Request) {
  if (!authConfigured()) return fail(404, "not_found", "Not found.");
  const body = await jsonBody(req);
  const next = safeNext(typeof body.next === "string" ? body.next : null);
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return fail(401, "sign_in_required", "That code didn't sign you in. Please try again.");
  const url = new URL(req.url);
  if (body.news === true) url.searchParams.set("news", "1");
  if (typeof body.tz === "string" && body.tz.length <= 64) url.searchParams.set("tz", body.tz);
  await finishSignIn(supabase, url, next);
  return clearSignInCookies(NextResponse.json({ next }));
}

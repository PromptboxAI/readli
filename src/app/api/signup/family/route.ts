import { NextResponse } from "next/server";
import { clearSignInCookies, finishSignIn } from "@/lib/auth/finish-sign-in";
import { emailTaken, normalizeEmail, UNCONFIRMED_FLAG } from "@/lib/auth/quick-signup";
import { authConfigured, supabaseServer } from "@/lib/auth/supabase";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody } from "@/lib/family/http";
import { familyAccountsEnabled } from "@/lib/family/session";
import { allow, clientAddress } from "@/lib/server/rate-limit";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NEXT = "/signup/family";

/**
 * POST { email, news?, tz? } from Create your family. A new email gets a Readli account made and signed
 * in on this device right away ({ signedIn: true }), so the buyer goes straight to checkout; the email is
 * confirmed after they pay (src/lib/auth/quick-signup.ts). An email that already has an account answers
 * { existing: true } and nothing changes: the page sends the usual code, because only the owner of an
 * account may sign in to it.
 */
export async function POST(req: Request) {
  if (!authConfigured() || !familyAccountsEnabled()) return fail(404, "not_found", "Not found.");
  const db = accountDb();
  if (!db) return fail(503, "no_account", "Accounts aren't available just now.");
  if (!allow(`quick-signup:${clientAddress(req)}`, 5, 10 * 60_000)) return fail(429, "rate_limited", "Too many tries. Please wait a few minutes and try again.");
  const body = await jsonBody(req);
  const email = normalizeEmail(body.email);
  if (!email) return fail(400, "bad_email", "Check the email address and try again.");

  const created = await db.auth.admin.createUser({ email, email_confirm: true, app_metadata: { [UNCONFIRMED_FLAG]: true } });
  if (created.error) {
    if (emailTaken(created.error)) return NextResponse.json({ existing: true });
    console.error("quick signup: create user failed", created.error.message);
    return fail(502, "signup_failed", "We couldn't set up your account just now. Please try again.");
  }
  // Sign the new account in here: a one-time sign-in token, used at once by this server.
  const link = await db.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data?.properties?.hashed_token;
  const supabase = await supabaseServer();
  const signedIn = tokenHash ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" }) : null;
  if (!signedIn || signedIn.error) {
    // The account exists now, so the usual code still works.
    console.error("quick signup: sign-in failed", link.error?.message ?? signedIn?.error?.message ?? "no token");
    return NextResponse.json({ existing: true });
  }
  const url = new URL(req.url);
  if (body.news === true) url.searchParams.set("news", "1");
  if (typeof body.tz === "string" && body.tz.length <= 64) url.searchParams.set("tz", body.tz);
  await finishSignIn(supabase, req, url, NEXT, { confirmsEmail: false });
  return clearSignInCookies(NextResponse.json({ signedIn: true }));
}

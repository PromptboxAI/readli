import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authConfigured, safeNext, supabaseServer } from "@/lib/auth/supabase";

export const dynamic = "force-dynamic";

/** Finishes sign-in from Google or an email link, then continues to where the grown-up was going. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  if (!authConfigured()) return NextResponse.redirect(new URL("/login", url.origin));
  const supabase = await supabaseServer();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };
  if (error) {
    console.error("sign-in callback failed", error.message);
    return NextResponse.redirect(new URL(`/login?error=link&next=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}

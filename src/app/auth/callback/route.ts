import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authConfigured, safeNext, supabaseServer } from "@/lib/auth/supabase";
import { updatePreferences } from "@/lib/email/preferences";
import { accountDb } from "@/lib/family/account-store";
import { GROWNUP_COOKIE, PIN_RESUMED_COOKIE } from "@/lib/family/grownup-stash";
import { KIDS_COOKIE } from "@/lib/family/kids-mode";
import { currentDevice } from "@/lib/family/session";

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
  // The grown-up ticked the Bedtime Thursdays and news box on a signup page.
  if (url.searchParams.get("news") === "1") {
    const { data } = await supabase.auth.getUser();
    const db = accountDb();
    if (data.user && db) await updatePreferences(db, data.user.id, { marketing: true }, "signup").catch((err) => console.error("save marketing consent failed", err));
  }
  // Signing in again is how a grown-up leaves Kids Mode on a device, so this sign-in ends it, and
  // ends the kids device record too so it no longer shows as active.
  const kidsDevice = await currentDevice().catch(() => null);
  if (kidsDevice) {
    const { registry, device } = kidsDevice;
    await registry.update(device.id, { revokedAt: new Date().toISOString(), revokedBy: device.registeredBy, activeChildId: null }).catch(() => undefined);
  }
  const res = NextResponse.redirect(new URL(next, url.origin));
  res.cookies.delete(KIDS_COOKIE);
  // A full sign-in replaces any sign-in set aside for Kids Mode or brought back with the PIN.
  res.cookies.delete(GROWNUP_COOKIE);
  res.cookies.delete(PIN_RESUMED_COOKIE);
  return res;
}

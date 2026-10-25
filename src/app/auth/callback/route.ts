import type { EmailOtpType } from "@supabase/supabase-js";
import { after, NextResponse } from "next/server";
import { authConfigured, safeNext, supabaseServer } from "@/lib/auth/supabase";
import { recordEmailSignup } from "@/lib/email/signup";
import { GROWNUP_COOKIE, PIN_RESUMED_COOKIE } from "@/lib/family/grownup-stash";
import { KIDS_COOKIE } from "@/lib/family/kids-mode";
import { currentDevice } from "@/lib/family/session";
import { attributionFrom, sendCapiEvent } from "@/lib/server/meta-capi";

export const dynamic = "force-dynamic";

/**
 * Finishes sign-in from Google or an email link, then continues to where the grown-up was going. A new
 * Readli Family or Readli Voice account is Meta's CompleteRegistration (not invited storytellers, and not
 * for a browser that opted out).
 */
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
  const signup = await recordEmailSignup(supabase, url, next).catch((err) => {
    console.error("save email signup failed", err);
    return null;
  });
  const attribution = signup && signup.intent !== "voice_invited" ? attributionFrom(req, `${url.origin}/signup/${signup.intent}`) : null;
  if (signup && attribution) {
    after(() =>
      sendCapiEvent({
        name: "CompleteRegistration",
        eventId: `registration_${signup.userId}`,
        attribution,
        email: signup.email,
        externalId: signup.userId,
        customData: { content_name: signup.intent === "family" ? "Readli Family" : "Readli Voice" },
      }),
    );
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

import type { SupabaseClient } from "@supabase/supabase-js";
import { after, type NextResponse } from "next/server";
import { recordEmailSignup } from "@/lib/email/signup";
import { GROWNUP_COOKIE, PIN_RESUMED_COOKIE } from "@/lib/family/grownup-stash";
import { KIDS_COOKIE } from "@/lib/family/kids-mode";
import { currentDevice } from "@/lib/family/session";
import { attributionFrom, sendCapiEvent } from "@/lib/server/meta-capi";

/**
 * What every sign-in does once Supabase has a session, whether it came from an email link, Google or a
 * code typed on the page: save the signup details (news opt-in and time zone ride in `url`'s query), send
 * a new account's CompleteRegistration to Meta, and end Kids Mode on this device, since signing in again
 * is how a grown-up leaves it.
 */
export async function finishSignIn(supabase: SupabaseClient, req: Request, url: URL, next: string): Promise<void> {
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
  const kidsDevice = await currentDevice().catch(() => null);
  if (kidsDevice) {
    const { registry, device } = kidsDevice;
    await registry.update(device.id, { revokedAt: new Date().toISOString(), revokedBy: device.registeredBy, activeChildId: null }).catch(() => undefined);
  }
}

/** A full sign-in replaces Kids Mode and any sign-in set aside for it or brought back with the PIN. */
export function clearSignInCookies(res: NextResponse): NextResponse {
  res.cookies.delete(KIDS_COOKIE);
  res.cookies.delete(GROWNUP_COOKIE);
  res.cookies.delete(PIN_RESUMED_COOKIE);
  return res;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { recordEmailSignup } from "@/lib/email/signup";
import { GROWNUP_COOKIE, PIN_RESUMED_COOKIE } from "@/lib/family/grownup-stash";
import { KIDS_COOKIE } from "@/lib/family/kids-mode";
import { currentDevice } from "@/lib/family/session";

/**
 * What every sign-in does once Supabase has a session, whether it came from an email link, Google or a
 * code typed on the page: save the signup details (news opt-in and time zone ride in `url`'s query), and
 * end Kids Mode on this device, since signing in again is how a grown-up leaves it.
 */
export async function finishSignIn(supabase: SupabaseClient, url: URL, next: string): Promise<void> {
  await recordEmailSignup(supabase, url, next).catch((err) => console.error("save email signup failed", err));
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

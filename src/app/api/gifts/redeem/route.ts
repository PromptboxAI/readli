import { NextResponse } from "next/server";
import { updateDisplayName } from "@/lib/account/privacy";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi } from "@/lib/billing/stripe-api";
import { afterGiftRedeemed } from "@/lib/donations/server";
import { emailSecret } from "@/lib/email/send";
import { jsonBody } from "@/lib/family/http";
import { NAMED_COOKIE } from "@/lib/family/setup-cookie";
import { GiftError, redeemGiftCode } from "@/lib/gifting/server";
import { requestOrigin } from "@/lib/invitations/context";
import { withAccount } from "@/lib/invites/http";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * { code, familyName?, yourName?, pauseBilling? }. Starts Readli Family for the signed-in grown-up's own family.
 * No card needed. A paying subscriber must confirm pauseBilling: their Stripe billing then pauses for
 * the gift's months instead of running a second plan alongside it.
 */
export async function POST(req: Request) {
  const { code, familyName, yourName, pauseBilling } = await jsonBody(req);
  if (typeof code !== "string") return fail(400, "bad_code", "Enter your gift code.");
  return withAccount(async ({ db, user }) => {
    // The name they typed on the gift page is what setup greets them with (Kevin, 2026-11-03).
    if (typeof yourName === "string" && yourName.trim()) {
      await updateDisplayName(db, user.id, yourName);
    } else {
      const { error } = await db.from("adult_profiles").upsert({ user_id: user.id, display_name: user.name }, { onConflict: "user_id", ignoreDuplicates: true });
      if (error) throw new Error(`save adult profile: ${error.message}`);
    }
    const config = billingConfig();
    try {
      const result = await redeemGiftCode(db, code, user, {
        familyName: typeof familyName === "string" ? familyName : undefined,
        deferBilling: pauseBilling === true,
        stripe: config.mode === "off" ? null : new StripeApi(config),
      });
      const secret = emailSecret();
      if (result.giftId && secret) {
        // A welcome email is a nice-to-have: the claim has already succeeded, so a failure here is only logged.
        await afterGiftRedeemed({ db, secret, base: await requestOrigin() }, result.giftId, user, result.paidThrough).catch((err) =>
          console.error("gift follow-up failed", err instanceof Error ? err.message : err),
        );
      }
      const res = NextResponse.json({ householdId: result.householdId, paidThrough: result.paidThrough, ...(result.billingPaused ? { billingPaused: true } : {}) }, { headers: { "cache-control": "no-store" } });
      // They named themselves on the gift page, so setup's welcome doesn't ask again (Kevin, 2026-11-04).
      if (typeof yourName === "string" && yourName.trim()) res.cookies.set(NAMED_COOKIE, "1", { path: "/", maxAge: 86_400, sameSite: "lax", httpOnly: true });
      return res;
    } catch (err) {
      if (err instanceof GiftError) return fail(err.status, err.code, err.message);
      throw err;
    }
  });
}

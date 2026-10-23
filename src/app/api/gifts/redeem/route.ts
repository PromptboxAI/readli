import { NextResponse } from "next/server";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi } from "@/lib/billing/stripe-api";
import { jsonBody } from "@/lib/family/http";
import { GiftError, redeemGiftCode } from "@/lib/gifting/server";
import { withAccount } from "@/lib/invites/http";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * { code, familyName?, pauseBilling? }. Starts Readli Family for the signed-in grown-up's own family.
 * No card needed. A paying subscriber must confirm pauseBilling: their Stripe billing then pauses for
 * the gift's months instead of running a second plan alongside it.
 */
export async function POST(req: Request) {
  const { code, familyName, pauseBilling } = await jsonBody(req);
  if (typeof code !== "string") return fail(400, "bad_code", "Enter your gift code.");
  return withAccount(async ({ db, user }) => {
    const { error } = await db.from("adult_profiles").upsert({ user_id: user.id, display_name: user.name }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw new Error(`save adult profile: ${error.message}`);
    const config = billingConfig();
    try {
      const result = await redeemGiftCode(db, code, user, {
        familyName: typeof familyName === "string" ? familyName : undefined,
        deferBilling: pauseBilling === true,
        stripe: config.mode === "off" ? null : new StripeApi(config),
      });
      return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
    } catch (err) {
      if (err instanceof GiftError) return fail(err.status, err.code, err.message);
      throw err;
    }
  });
}

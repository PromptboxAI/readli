import { NextResponse } from "next/server";
import { jsonBody } from "@/lib/family/http";
import { GiftError, redeemGiftCode } from "@/lib/gifting/server";
import { withAccount } from "@/lib/invites/http";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** { code }. Starts Readli Family for the signed-in grown-up's own family. No card needed. */
export async function POST(req: Request) {
  const { code } = await jsonBody(req);
  if (typeof code !== "string") return fail(400, "bad_code", "Enter your gift code.");
  return withAccount(async ({ db, user }) => {
    const { error } = await db.from("adult_profiles").upsert({ user_id: user.id, display_name: user.name }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw new Error(`save adult profile: ${error.message}`);
    try {
      return NextResponse.json(await redeemGiftCode(db, code, user));
    } catch (err) {
      if (err instanceof GiftError) return fail(err.status, err.code, err.message);
      throw err;
    }
  });
}

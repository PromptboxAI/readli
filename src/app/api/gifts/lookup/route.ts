import { NextResponse } from "next/server";
import { currentAdult } from "@/lib/auth/adult";
import { accountDb } from "@/lib/family/account-store";
import { jsonBody } from "@/lib/family/http";
import { normalizeGiftCode } from "@/lib/gifting/codes";
import { hashGiftCode } from "@/lib/gifting/codes.server";
import { complimentaryForCode } from "@/lib/gifting/server";
import { giftViewer } from "@/lib/gifting/viewer";
import { fail } from "@/lib/server/http";
import { allow, clientAddress } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

/**
 * { code } → the complimentary membership's page, posted so the code stays out of URLs and logs.
 * Signed in, it also says what the grown-up already has, so the page can explain how the gift fits.
 * Looking a code up never claims it.
 */
export async function POST(req: Request) {
  if (!allow(`gift-lookup:${clientAddress(req)}`, 30, 60_000)) return fail(429, "slow_down", "Please wait a minute and try again.");
  const db = accountDb();
  if (!db) return fail(404, "accounts_off", "Gifts aren't switched on here yet.");
  const { code } = await jsonBody(req);
  const normalized = typeof code === "string" ? normalizeGiftCode(code) : null;
  if (!normalized) return fail(400, "bad_code", "That doesn't look like a gift code. It's 12 letters and numbers, like ABCD-EFGH-JKMN.");
  const gift = await complimentaryForCode(db, normalized);
  if (!gift) {
    const { data } = await db.from("gifts").select("id").eq("code_hash", hashGiftCode(normalized)).limit(1);
    if (data?.length) return NextResponse.json({ kind: "gift" }, { headers: { "cache-control": "no-store" } });
    return fail(404, "gift_not_found", "We couldn't find that gift code. Check it and try again.");
  }
  const viewer = await giftViewer(db, (await currentAdult())?.id ?? null, gift.months);
  return NextResponse.json({ kind: "complimentary", gift, viewer }, { headers: { "cache-control": "no-store" } });
}

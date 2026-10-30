import type { SupabaseClient } from "@supabase/supabase-js";
import { effectivePlan } from "@/lib/billing/price-settings";
import { money } from "@/lib/donations/program";
import { requestOrigin } from "@/lib/invitations/context";
import { accountDb } from "@/lib/family/account-store";
import { giftCodeCipher, type GiftCodeCipher } from "@/lib/gifting/code-cipher";
import { fail } from "@/lib/server/http";
import { currentAdmin, type AdminUser } from "./access";

export interface ArtworkContext {
  db: SupabaseClient;
  admin: AdminUser;
  cipher: GiftCodeCipher;
  origin: string;
  /** The live annual Family price, printed on Readli Gives Back certificates. */
  retailValue: string;
}

/** Admin-only downloads: never cached, never indexed. */
export async function withArtworkAdmin(run: (ctx: ArtworkContext) => Promise<Response>): Promise<Response> {
  const admin = await currentAdmin();
  if (!admin) return fail(404, "not_found", "Not found.");
  const db = accountDb();
  const cipher = giftCodeCipher();
  if (!db || !cipher) return fail(503, "not_configured", "Complimentary memberships need Supabase connected.");
  return run({ db, admin, cipher, origin: await requestOrigin(), retailValue: money((await effectivePlan(db)).familyAnnualPriceCents) });
}

export function download(body: Buffer | string, filename: string, type: string): Response {
  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}

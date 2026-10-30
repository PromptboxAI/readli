import { currentAdult } from "@/lib/auth/adult";
import type { SignedInUser } from "@/lib/auth/supabase";
import { billingConfig } from "@/lib/billing/config";
import { StripeApi } from "@/lib/billing/stripe-api";
import { accountDb } from "@/lib/family/account-store";
import { invitationSecret } from "@/lib/invitations/server";
import { SITE_URL } from "@/lib/seo/site";
import { fail } from "@/lib/server/http";
import { allow } from "@/lib/server/rate-limit";
import { SponsorshipError } from "./rules";
import { sponsoredFamilyOn, type SponsorshipContext } from "./server";

/**
 * Sponsorships need payments on and real accounts. The sponsored_family switch gates selling new gifts
 * only: switching it off never strands a gift someone already paid for.
 */
export async function sponsorshipContext(opts: { newGifts?: boolean } = {}): Promise<SponsorshipContext | null> {
  const config = billingConfig();
  const db = accountDb();
  const secret = invitationSecret();
  if (config.mode === "off" || !db || !secret) return null;
  if (opts.newGifts && !(await sponsoredFamilyOn(db))) return null;
  return { db, stripe: new StripeApi(config), secret, base: SITE_URL, livemode: config.mode === "live" };
}

export async function withSponsorship(run: (ctx: SponsorshipContext, user: SignedInUser) => Promise<Response>, opts: { newGifts?: boolean } = {}): Promise<Response> {
  const ctx = await sponsorshipContext(opts);
  if (!ctx) return fail(404, "not_found", "Not found.");
  // Never from a device in Kids Mode.
  const user = await currentAdult();
  if (!user) return fail(401, "sign_in_required", "Please sign in to continue.");
  if (!allow(`sponsorship:${user.id}`, 20, 60_000)) return fail(429, "slow_down", "That's a lot at once. Please wait a minute and try again.");
  try {
    return await run(ctx, user);
  } catch (err) {
    if (err instanceof SponsorshipError) return fail(err.status, err.code, err.message);
    throw err;
  }
}

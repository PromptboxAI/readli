import { cookies, headers } from "next/headers";
import { currentAdult } from "@/lib/auth/adult";
import { accountDb } from "@/lib/family/account-store";
import { familyAccountsEnabled, familyPreviewEnabled } from "@/lib/family/session";
import type { RewardsState } from "./rewards";
import { attributeReferral, ensureReferralCode, REFERRAL_COOKIE, referralLink, rewardsState } from "./server";

export type RewardsPage = { mode: "live"; state: RewardsState; link: string } | { mode: "sign_in" } | { mode: "preview" };

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "readli.ai";
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}

/**
 * Rewards for the signed-in grown-up. Call only when rewards are visible. Also attributes a pending
 * referral from a link they signed up through; that is a no-op once their family has one.
 */
export async function rewardsPage(): Promise<RewardsPage> {
  const db = accountDb();
  if (!db || !familyAccountsEnabled()) return { mode: "preview" };
  const user = await currentAdult();
  if (!user) return familyPreviewEnabled() ? { mode: "preview" } : { mode: "sign_in" };
  const code = (await cookies()).get(REFERRAL_COOKIE)?.value;
  if (code) {
    await attributeReferral(db, code, user.id).catch((err) => console.error("referral attribution failed", err));
  }
  const [state, own] = await Promise.all([rewardsState(db, user.id), ensureReferralCode(db, user.id)]);
  return { mode: "live", state, link: referralLink(await origin(), own) };
}

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The one place that decides whether a family gets the 14-day Readli Family trial (Kevin, 2026-10-11:
 * one introductory trial per eligible household and account, with anti-abuse checks that don't block
 * families who simply share an address, device or network).
 *
 * A trial is offered when all of these hold:
 * - trials are on (REWARDS_TRIAL_DAYS above 0);
 * - the grown-up's email is verified;
 * - neither this household nor any household the grown-up belongs to has had a plan (a tester plan aside);
 * - no earlier trial was claimed by this household, this account, or the same email (normalized, so
 *   "Jo.Smith+kids@gmail.com" and "josmith@gmail.com" count as one).
 * When a trial starts, the webhook records the claim with a hash of the card's Stripe fingerprint. A
 * card that already started a trial for another household still gets Readli Family, but without the
 * free trial credits, and the case goes to the admin exception queue. No device fingerprints, IP
 * addresses or postal addresses are used.
 */

export type TrialDecision = { eligible: true; days: number } | { eligible: false; days: 0; reason: TrialRefusal };
export type TrialRefusal = "trials_off" | "email_unverified" | "had_plan" | "already_claimed";

export interface TrialFacts {
  trialDays: number;
  emailVerified: boolean;
  /** Plans, past or present, of this household and every household the grown-up belongs to. */
  plans: readonly { source: string }[];
  /** Trial claims matching this household, this account or this email. */
  priorClaims: number;
}

export function trialDecision(f: TrialFacts): TrialDecision {
  if (!(f.trialDays > 0)) return { eligible: false, days: 0, reason: "trials_off" };
  if (!f.emailVerified) return { eligible: false, days: 0, reason: "email_unverified" };
  if (f.plans.some((p) => p.source !== "tester")) return { eligible: false, days: 0, reason: "had_plan" };
  if (f.priorClaims > 0) return { eligible: false, days: 0, reason: "already_claimed" };
  return { eligible: true, days: Math.floor(f.trialDays) };
}

/** The address a person can receive at, so plus-tags and Gmail dots don't make new identities. */
export function normalizeEmail(email: string): string {
  const [rawLocal, rawDomain] = email.trim().toLowerCase().split("@");
  if (!rawLocal || !rawDomain) return email.trim().toLowerCase();
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  let local = rawLocal.split("+")[0]!;
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
export const emailKey = (email: string) => sha(`email:${normalizeEmail(email)}`);
export const cardKey = (fingerprint: string) => sha(`card:${fingerprint}`);

async function rows(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

/** The account's email and whether it is verified (Google sign-ins are), from Supabase Auth. */
export async function accountEmail(db: SupabaseClient, userId: string): Promise<{ email: string | null; verified: boolean }> {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data?.user) return { email: null, verified: false };
  return { email: data.user.email ?? null, verified: Boolean(data.user.email_confirmed_at) };
}

/** Reads the facts for trialDecision with the service role. */
export async function loadTrialFacts(
  db: SupabaseClient,
  who: { userId: string; email: string | null; emailVerified: boolean; householdId: string },
  trialDays: number,
): Promise<TrialFacts> {
  const homes = await rows(db.from("household_members").select("household_id").eq("user_id", who.userId), "read households");
  const householdIds = [...new Set([who.householdId, ...homes.map((h) => h.household_id as string)])];
  const plans = await rows(db.from("household_entitlements").select("source").in("household_id", householdIds), "read plan history");
  const keys = [`household_id.eq.${who.householdId}`, `user_id.eq.${who.userId}`];
  if (who.email) keys.push(`email_key.eq.${emailKey(who.email)}`);
  const claims = await rows(db.from("trial_claims").select("id").or(keys.join(",")).limit(1), "read trial claims");
  return { trialDays, emailVerified: who.emailVerified, plans: plans.map((p) => ({ source: p.source as string })), priorClaims: claims.length };
}

export interface TrialStart {
  householdId: string;
  subscriptionRef: string;
  userId: string | null;
  email: string | null;
  /** The Stripe card fingerprint of the subscription's payment method, when Stripe gives one. */
  cardFingerprint: string | null;
}

/**
 * Records a trial when its subscription first arrives (safe to repeat). Returns whether its trial
 * credits are withheld because the same card already started a trial for another household.
 */
export async function recordTrialClaim(db: SupabaseClient, t: TrialStart): Promise<{ withheld: boolean }> {
  const existing = await rows(db.from("trial_claims").select("credits_withheld").eq("subscription_ref", t.subscriptionRef), "read trial claim");
  if (existing[0]) return { withheld: existing[0].credits_withheld === true };
  const card = t.cardFingerprint ? cardKey(t.cardFingerprint) : null;
  const reused = card
    ? (await rows(db.from("trial_claims").select("id").eq("card_key", card).neq("household_id", t.householdId).limit(1), "read card claims")).length > 0
    : false;
  const { error } = await db.from("trial_claims").upsert(
    {
      household_id: t.householdId,
      user_id: t.userId,
      email_key: t.email ? emailKey(t.email) : null,
      card_key: card,
      subscription_ref: t.subscriptionRef,
      credits_withheld: reused,
    },
    { onConflict: "subscription_ref", ignoreDuplicates: true },
  );
  if (error) throw new Error(`record trial claim: ${error.message}`);
  return { withheld: reused };
}

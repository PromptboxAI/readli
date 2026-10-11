import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityId, RewardsState } from "./rewards";

/**
 * Readli Rewards for real accounts (migrations 000500 and 20261011000300). Referral links carry a
 * code; signing up through one stores it in a cookie, and the referral is attributed once the new
 * grown-up has a family. The database decides everything that earns a month: self-referrals,
 * existing customers, circular referrals, the paid-cycle threshold, the rolling cap and the
 * program switch.
 */
export const REFERRAL_COOKIE = "readli_ref";
export const REFERRAL_COOKIE_DAYS = 30;
export const REFERRAL_CODE = /^[a-z0-9]{6,16}$/;

type Row = Record<string, unknown>;

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

export function normalizeReferralCode(code: string | undefined | null): string | null {
  const c = (code ?? "").trim().toLowerCase();
  return REFERRAL_CODE.test(c) ? c : null;
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function newReferralCode(): string {
  return Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/r/${code}`;
}

/** The grown-up's referral code, created the first time it's needed. */
export async function ensureReferralCode(db: SupabaseClient, userId: string): Promise<string> {
  const [existing] = await q(db.from("referral_codes").select("code").eq("user_id", userId).limit(1), "read referral code");
  if (existing) return existing.code as string;
  for (let i = 0; i < 3; i++) {
    const { error } = await db.from("referral_codes").insert({ user_id: userId, code: newReferralCode() });
    if (!error) break;
    if (!/duplicate|unique/i.test(error.message)) throw new Error(`save referral code: ${error.message}`);
  }
  const [row] = await q(db.from("referral_codes").select("code").eq("user_id", userId).limit(1), "read referral code");
  if (!row) throw new Error("save referral code: no code");
  return row.code as string;
}

export type Attribution = "unknown_code" | "no_family" | "self_referral" | "already_referred" | "attributed" | "existing_customer" | "circular";

/** Links the grown-up's family to whoever referred it. Safe to call repeatedly: the first link wins. */
export async function attributeReferral(db: SupabaseClient, code: string, userId: string): Promise<Attribution> {
  const c = normalizeReferralCode(code);
  if (!c) return "unknown_code";
  const { data, error } = await db.rpc("attribute_referral", { p_code: c, p_user: userId });
  if (error) throw new Error(`attribute referral: ${error.message}`);
  return data as Attribution;
}

/**
 * For the payments webhook: the referred household paid a monthly charge itself. Returns true when
 * that payment earned its referrer a free month. Trial, gift, donated and reward months must not be
 * reported here.
 */
export async function recordReferralPaidCycle(db: SupabaseClient, householdId: string): Promise<boolean> {
  const { data, error } = await db.rpc("record_referral_paid_cycle", { p_household: householdId });
  if (error) throw new Error(`record paid cycle: ${error.message}`);
  return data === true;
}

/** For billing: uses one banked free month to waive this month's subscription charge, if there is one. */
export async function useRewardMonth(db: SupabaseClient, householdId: string): Promise<boolean> {
  const { data, error } = await db.rpc("use_reward_month", { p_household: householdId });
  if (error) throw new Error(`use reward month: ${error.message}`);
  return data === true;
}

const YEAR_MS = 365 * 86_400_000;

/** Real progress for the tracker. Nothing here is about a child beyond whether the family library has a book. */
export async function rewardsState(db: SupabaseClient, userId: string, now = new Date()): Promise<RewardsState> {
  const completed = new Set<ActivityId>();
  const [homes, marked, voices] = await Promise.all([
    q(db.from("household_members").select("household_id").eq("user_id", userId).eq("role", "guardian").is("removed_at", null).order("joined_at").limit(1), "read family"),
    q(db.from("reward_activities").select("activity").eq("user_id", userId), "read activities"),
    q(db.from("voice_profiles").select("id").eq("owner_id", userId).neq("status", "deleted").limit(1), "read voices"),
  ]);
  for (const r of marked) completed.add(r.activity as ActivityId);
  if (voices.length) completed.add("first_voice_or_story");
  const householdId = homes[0]?.household_id as string | undefined;
  if (!householdId) return { completed, pendingReferrals: 0, monthsEarned12: 0, monthsBanked: 0 };
  completed.add("family_account");

  const [kids, invites, plays, referrals, grants] = await Promise.all([
    q(db.from("child_profiles").select("id").eq("household_id", householdId), "read kids"),
    q(db.from("household_invitations").select("id").eq("household_id", householdId).limit(1), "read invitations"),
    q(db.from("narration_plays").select("id").eq("household_id", householdId).limit(1), "read plays"),
    q(db.from("referrals").select("qualified_at, rejected_reason").eq("referrer_household_id", householdId), "read referrals"),
    q(db.from("reward_grants").select("granted_at, applied_at").eq("household_id", householdId), "read reward months"),
  ]);
  if (kids.length) {
    const favorites = await q(db.from("child_favorites").select("child_id").in("child_id", kids.map((k) => k.id as string)).limit(1), "read favorites");
    if (favorites.length) completed.add("family_library");
  }
  if (invites.length) completed.add("invite_storyteller");
  if (plays.length) completed.add("first_voice_or_story");
  if (referrals.some((r) => r.qualified_at)) completed.add("referral");
  return {
    completed,
    pendingReferrals: referrals.filter((r) => !r.qualified_at && !r.rejected_reason).length,
    monthsEarned12: grants.filter((g) => new Date(g.granted_at as string).getTime() > now.getTime() - YEAR_MS).length,
    monthsBanked: grants.filter((g) => !g.applied_at).length,
  };
}

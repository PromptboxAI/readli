import type { SupabaseClient } from "@supabase/supabase-js";
import { removeUnusedCredits } from "@/lib/billing/credit-refunds";
import { cleanHousehold, openException } from "@/lib/lifecycle/cleanup";
import { writeAudit } from "@/lib/lifecycle/db";
import type { ProviderRefCipher } from "@/lib/server/provider-ref";
import type { VoiceProvider } from "@/lib/voice/provider";

/**
 * A signed-in grown-up's own account: their name, a copy of their data, and deleting the account.
 * Everything runs on the server with the service role, scoped to the one user id the session proved.
 */

type Row = Record<string, unknown>;
type Query = PromiseLike<{ data: unknown; error: { message: string } | null }>;

async function rows(p: Query, what: string): Promise<Row[]> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as Row[];
}

async function run(p: Query, what: string): Promise<void> {
  const { error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
}

const ids = (list: Row[], key = "id") => [...new Set(list.map((r) => r[key] as string))];

/** Buckets that hold a person's voice recordings and the audio made from their voice. */
export const RECORDINGS_BUCKET = "voice-recordings";
/** Grown-ups' profile photos, one folder per person. */
export const PHOTOS_BUCKET = "profile-photos";
/** Approved family-invitation previews in the contributor's voice (src/lib/invitations). */
export const PREVIEWS_BUCKET = "voice-previews";
export const NARRATION_BUCKETS = { segments: "narrations", assets: "generated-audio" } as const;

export class AccountError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly userMessage: string,
  ) {
    super(userMessage);
  }
}

export function cleanDisplayName(value: unknown): string {
  const name = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!name || name.length > 60) throw new AccountError(400, "bad_name", "Please use a name between 1 and 60 characters.");
  return name;
}

/** Renames the grown-up everywhere their name shows: their family profile and their sign-in. */
export async function updateDisplayName(db: SupabaseClient, userId: string, value: unknown): Promise<string> {
  const name = cleanDisplayName(value);
  await run(db.from("adult_profiles").upsert({ user_id: userId, display_name: name }, { onConflict: "user_id" }), "save name");
  const { error } = await db.auth.admin.updateUserById(userId, { user_metadata: { full_name: name } });
  if (error) throw new Error(`save sign-in name: ${error.message}`);
  return name;
}

/** What a grown-up types to confirm deleting their account. */
export const DELETE_CONFIRMATION = "DELETE";

/**
 * The one thing that holds a deletion: kids in a shared family who would be left with no grown-up in
 * charge. A renewing plan or gift never blocks it (Kevin, 2026-10-12): deletion cancels renewals first.
 */
export type DeletionBlocker = { kind: "only_guardian"; householdId: string; householdName: string };

interface Homes {
  /** Families nobody else belongs to; they go with the account. */
  solo: string[];
  blockers: DeletionBlocker[];
}

async function homesOf(db: SupabaseClient, userId: string): Promise<Homes> {
  const mine = (await rows(db.from("household_members").select("household_id, role, removed_at").eq("user_id", userId), "read memberships")).filter(
    (m) => m.removed_at === null,
  );
  const homeIds = ids(mine, "household_id");
  if (!homeIds.length) return { solo: [], blockers: [] };
  const [members, homes, kids] = await Promise.all([
    rows(db.from("household_members").select("household_id, user_id, role, removed_at").in("household_id", homeIds), "read members"),
    rows(db.from("households").select("id, name").in("id", homeIds), "read households"),
    rows(db.from("child_profiles").select("id, household_id, deleted_at").in("household_id", homeIds), "read kids"),
  ]);
  const liveKids = kids.filter((k) => k.deleted_at === null);
  const guardians = liveKids.length
    ? (await rows(db.from("child_guardians").select("child_id, user_id, removed_at").in("child_id", ids(liveKids)), "read guardians")).filter(
        (g) => g.removed_at === null,
      )
    : [];

  const out: Homes = { solo: [], blockers: [] };
  for (const home of homeIds) {
    const others = members.filter((m) => m.household_id === home && m.user_id !== userId && m.removed_at === null);
    if (!others.length) {
      out.solo.push(home);
      continue;
    }
    const iGuard = mine.some((m) => m.household_id === home && m.role === "guardian");
    if (!iGuard) continue;
    const otherGuardians = new Set(others.filter((m) => m.role === "guardian").map((m) => m.user_id));
    const kidLeftAlone = liveKids
      .filter((k) => k.household_id === home)
      .some((k) => !guardians.some((g) => g.child_id === k.id && otherGuardians.has(g.user_id)));
    if (!otherGuardians.size || kidLeftAlone) {
      out.blockers.push({ kind: "only_guardian", householdId: home, householdName: (homes.find((h) => h.id === home)?.name as string) ?? "your family" });
    }
  }
  return out;
}

/** What has to happen before the account can go: only a shared family's kids left with no grown-up in charge. */
export async function deletionBlockers(db: SupabaseClient, userId: string): Promise<DeletionBlocker[]> {
  return (await homesOf(db, userId)).blockers;
}

/** Stripe calls account deletion needs, to stop a plan renewing before the account goes. */
export interface DeletionBilling {
  /**
   * Ends the subscription now, without refunding or crediting the unused part of the period (Kevin,
   * 2026-10-12: no refunds on cancellation unless local law requires one). Returns the customer.
   */
  cancel(subscriptionRef: string): Promise<{ customer: string }>;
}

/**
 * Stops everything that would renew once the account is gone: the Readli plans of families only this
 * grown-up belongs to (cancelled now; credit for unused time goes to the admin queue to be refunded)
 * and gift sponsorships they pay for (renewals stop; recipients keep the month already paid for).
 * Runs before anything is deleted, so a failure leaves the account as it was.
 */
async function stopRenewals(db: SupabaseClient, billing: DeletionBilling | null, userId: string, solo: string[], at: string) {
  const plans = solo.length
    ? (await rows(db.from("household_entitlements").select("household_id, status, ends_at, provider_subscription_ref").in("household_id", solo), "read plans")).filter(
        (p) => p.status === "active" && typeof p.provider_subscription_ref === "string" && p.provider_subscription_ref,
      )
    : [];
  if (plans.length && !billing) {
    throw new AccountError(503, "billing_off", "We can't reach billing right now to stop your plan renewing, so your account hasn't been deleted. Please try again later.");
  }
  const ended: { householdId: string; subscription: string }[] = [];
  for (const p of plans) {
    await billing!.cancel(p.provider_subscription_ref as string);
    ended.push({ householdId: p.household_id as string, subscription: p.provider_subscription_ref as string });
  }
  const [gifts, giftPlans] = await Promise.all([
    rows(db.from("gifts").select("id, plan_id, status, renewals_stopped").eq("giver_id", userId), "read gifts"),
    rows(db.from("gift_plans").select("id, kind"), "read gift plans"),
  ]);
  const recurring = new Set(giftPlans.filter((g) => g.kind === "recurring").map((g) => g.id));
  const renewing = gifts.filter((g) => ["awaiting_payment", "scheduled", "sent", "active"].includes(g.status as string) && !g.renewals_stopped && recurring.has(g.plan_id));
  if (renewing.length) await run(db.from("gifts").update({ renewals_stopped: true }).in("id", ids(renewing)), "stop gift renewals");
  return { plansEnded: ended, giftRenewalsStopped: renewing.length, at };
}

export async function removeObjects(db: SupabaseClient, bucket: string, keys: string[]): Promise<number> {
  for (let i = 0; i < keys.length; i += 100) {
    const { error } = await db.storage.from(bucket).remove(keys.slice(i, i + 100));
    if (error) throw new Error(`remove ${bucket} audio: ${error.message}`);
  }
  return keys.length;
}

/** Every file under `${folder}/` in a bucket, so uploads without a database row are found too. */
export async function folderKeys(db: SupabaseClient, bucket: string, folder: string): Promise<string[]> {
  const keys: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(folder, { limit: 1000, offset });
    if (error) throw new Error(`list ${bucket} audio: ${error.message}`);
    keys.push(...(data ?? []).filter((f) => f.id !== null).map((f) => `${folder}/${f.name}`));
    if (!data || data.length < 1000) return keys;
  }
}

export interface DeletionResult {
  deleted: boolean;
  blockers: DeletionBlocker[];
  voicesRemoved: number;
  audioFilesRemoved: number;
}

/**
 * Deletes a grown-up's account (Kevin, 2026-10-11, decision 3; 2026-10-12, answer 3), whenever they ask,
 * in an order that can be safely retried if any step fails:
 * 0. renewals stop first: plans of families only they belong to are cancelled (unused paid time is
 *    credited and queued for a refund) and gift sponsorships stop renewing;
 * 1. their clones at the voice provider (ElevenLabs), so nothing new can be made in their voice;
 * 2. their voices are withdrawn: unfinished narration stops everywhere (unused credits go back),
 *    no new narration can be requested, and their AI-training permission ends (a database trigger
 *    records the withdrawal on their agreement history);
 * 3. every original recording of them and their profile photo are removed from storage, with a
 *    completed recording-deletion record kept for audit;
 * 4. families only they belong to are cleaned up the same way as at Day 30 (their saved stories, kids
 *    profiles and listening history go), but the family record stays so its plans, credits and
 *    payment records survive; unspent purchased credits go to the admin exception queue;
 * 5. the sign-in itself goes, which removes their profile, memberships and guardianships.
 * Stories already made in their voice for other families stay playable there, as the Voice Recording
 * & AI Training Agreement allows. Removing a specific story for legal reasons is a separate, audited
 * admin process (lifecycle/legal-removal.ts). Their agreement history is kept with the account link
 * cleared.
 */
export async function deleteAccount(
  deps: { db: SupabaseClient; provider: VoiceProvider | null; refs: ProviderRefCipher | null; billing?: DeletionBilling | null; now?: () => Date },
  userId: string,
): Promise<DeletionResult> {
  const { db, provider, refs } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const at = now.toISOString();
  const { solo, blockers } = await homesOf(db, userId);
  if (blockers.length) return { deleted: false, blockers, voicesRemoved: 0, audioFilesRemoved: 0 };

  const voices = (await rows(db.from("voice_profiles").select("id, status, provider_voice_id_encrypted").eq("owner_id", userId), "read voices")).filter(
    (v) => v.status !== "deleted",
  );
  const cloned = voices.filter((v) => typeof v.provider_voice_id_encrypted === "string" && v.provider_voice_id_encrypted);
  if (cloned.length && (!provider || !refs)) {
    throw new AccountError(503, "voice_provider_off", "We can't reach our voice service right now, so your account hasn't been deleted. Please try again later.");
  }
  const renewals = await stopRenewals(db, deps.billing ?? null, userId, solo, at);
  for (const v of cloned) await provider!.deleteVoice(refs!.decrypt(v.provider_voice_id_encrypted as string));

  for (const v of voices) {
    await run(
      db
        .from("voice_profiles")
        .update({
          status: "withdrawn",
          withdrawn_at: v.status === "withdrawn" ? undefined : at,
          clone_retired_at: at,
          provider_voice_id_encrypted: null,
          owner_deleted_at: at,
          updated_at: at,
        })
        .eq("id", v.id as string),
      "withdraw voice",
    );
    await run(db.from("voice_consents").update({ revoked_at: at }).eq("voice_id", v.id as string).is("revoked_at", null), "withdraw voice consent");
    await run(db.rpc("stop_voice_narration", { p_voice: v.id as string }), "stop narration in progress");
  }

  let audioFilesRemoved = 0;
  const sessions = await rows(db.from("voice_training_sessions").select("id").eq("owner_id", userId), "read recording sessions");
  const takes = sessions.length ? await rows(db.from("voice_training_segments").select("storage_key").in("session_id", ids(sessions)), "read recordings") : [];
  const recordings = new Set([...keysOf(takes), ...(await folderKeys(db, RECORDINGS_BUCKET, userId))]);
  audioFilesRemoved += await removeObjects(db, RECORDINGS_BUCKET, [...recordings]);
  await run(
    db.from("voice_recording_deletions").insert({
      owner_id: userId,
      voice_id: null,
      reason: "account_deletion",
      requested_at: at,
      due_at: at,
      status: "completed",
      completed_at: at,
      files_removed: recordings.size,
      detail: { voices: voices.length, sessions: sessions.length },
    }),
    "record recording deletion",
  );
  audioFilesRemoved += await removeObjects(db, PREVIEWS_BUCKET, await folderKeys(db, PREVIEWS_BUCKET, userId));
  await removeObjects(db, PHOTOS_BUCKET, await folderKeys(db, PHOTOS_BUCKET, userId));

  await run(
    db
      .from("child_voice_approvals")
      .update({ revoked_at: at, revoked_by: userId, revoke_reason: "guardian_removed" })
      .eq("approved_by", userId)
      .is("revoked_at", null),
    "end approvals",
  );

  let creditsRemoved = 0;
  for (const home of solo) {
    await run(db.rpc("stop_household_narration", { p_household: home }), "stop family narration");
    audioFilesRemoved += (await cleanHousehold(db, home, await soloLibraries(db, home), at)).audioFiles;
    creditsRemoved += await removeUnusedCredits(db, home, at);
  }

  await writeAudit(db, [
    {
      actor: "account-owner",
      action: "account_deleted",
      detail: {
        voices: voices.length,
        clones_deleted: cloned.length,
        recordings_removed: recordings.size,
        families_cleaned: solo.length,
        plans_ended: renewals.plansEnded,
        credits_removed: creditsRemoved,
        gift_renewals_stopped: renewals.giftRenewalsStopped,
      },
    },
    ...voices.map((v) => ({ actor: "account-owner", action: "voice_withdrawn", voiceId: v.id as string, detail: { reason: "account_deleted" } })),
  ]);

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new Error(`delete sign-in: ${error.message}`);
  return { deleted: true, blockers: [], voicesRemoved: cloned.length, audioFilesRemoved };
}

/** A solo family's own narration: libraries scoped to it (shared libraries belong to the voice). */
async function soloLibraries(db: SupabaseClient, householdId: string): Promise<string[]> {
  return ids(await rows(db.from("narration_libraries").select("key").eq("scope", householdId), "read family narration"), "key");
}

export function keysOf(list: Row[]): string[] {
  return [...new Set(list.map((r) => r.storage_key).filter((k): k is string => typeof k === "string" && k.length > 0))];
}

const pick = (r: Row, keys: string[]) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null]));

/**
 * A copy of what Readli keeps about this grown-up, as JSON. It covers their own data and the kids
 * profiles they look after. Other family members' details, and secrets such as the provider voice
 * id or gift codes, stay out.
 */
export async function exportAccountData(db: SupabaseClient, user: { id: string; email: string | null; name: string }) {
  const me = user.id;
  const [profile, memberships, voices, receipts, sessions, invites, giftsGiven, giftsReceived, rewards, referral, approvals, agreements] = await Promise.all([
    rows(db.from("adult_profiles").select("*").eq("user_id", me), "read profile"),
    rows(db.from("household_members").select("*").eq("user_id", me), "read memberships"),
    rows(db.from("voice_profiles").select("*").eq("owner_id", me), "read voices"),
    rows(db.from("consent_receipts").select("*").eq("user_id", me), "read consent receipts"),
    rows(db.from("voice_training_sessions").select("*").eq("owner_id", me), "read recordings"),
    rows(db.from("household_invitations").select("*").eq("inviter_id", me), "read invitations"),
    rows(db.from("gifts").select("*").eq("giver_id", me), "read gifts given"),
    rows(db.from("gifts").select("*").eq("recipient_user_id", me), "read gifts received"),
    rows(db.from("reward_activities").select("*").eq("user_id", me), "read rewards"),
    rows(db.from("referral_codes").select("*").eq("user_id", me), "read referral code"),
    rows(db.from("child_voice_approvals").select("*").eq("approved_by", me), "read approvals"),
    rows(db.from("voice_rights_agreements").select("*").eq("contributor_id", me), "read voice agreements"),
  ]);
  const homeIds = ids(memberships, "household_id");
  const voiceIds = ids(voices);
  const [homes, guarded, shares, consents] = await Promise.all([
    homeIds.length ? rows(db.from("households").select("id, name, created_at").in("id", homeIds), "read families") : [],
    rows(db.from("child_guardians").select("*").eq("user_id", me), "read guardianships"),
    voiceIds.length ? rows(db.from("voice_household_shares").select("*").in("voice_id", voiceIds), "read voice sharing") : [],
    voiceIds.length ? rows(db.from("voice_consents").select("*").in("voice_id", voiceIds), "read voice consents") : [],
  ]);
  const kidIds = ids(guarded, "child_id");
  const [kids, favorites, progress] = kidIds.length
    ? await Promise.all([
        rows(db.from("child_profiles").select("*").in("id", kidIds), "read kids"),
        rows(db.from("child_favorites").select("*").in("child_id", kidIds), "read favourites"),
        rows(db.from("child_book_progress").select("*").in("child_id", kidIds), "read reading places"),
      ])
    : [[], [], []];
  const homeName = (id: unknown) => (homes.find((h) => h.id === id)?.name as string) ?? null;
  const kidName = (id: unknown) => (kids.find((k) => k.id === id)?.nickname as string) ?? null;

  return {
    exportedAt: new Date().toISOString(),
    about:
      "Everything Readli keeps about you and the kids profiles you look after. Voice recordings and narration audio aren't in this file; ask Readli support for a copy.",
    account: {
      id: me,
      email: user.email,
      name: user.name,
      ...pick(profile[0] ?? {}, ["display_name", "marketing_opt_in", "created_at", "updated_at"]),
      profilePhoto: profile[0]?.avatar_path ? { consentGivenAt: profile[0].photo_consent_at ?? null } : null,
    },
    families: memberships.map((m) => ({
      family: homeName(m.household_id),
      ...pick(m, ["role", "relationship_label", "joined_at", "removed_at"]),
    })),
    kidsYouLookAfter: kids.map((k) => ({
      ...pick(k, ["nickname", "icon", "age_band", "created_at", "deleted_at"]),
      family: homeName(k.household_id),
      favourites: favorites.filter((f) => f.child_id === k.id).map((f) => pick(f, ["book_slug", "created_at"])),
      readingPlaces: progress.filter((p) => p.child_id === k.id).map((p) => pick(p, ["book_slug", "sentence", "updated_at"])),
    })),
    voices: voices.map((v) => ({
      ...pick(v, ["id", "display_name", "clone_type", "provider", "status", "created_at", "deleted_at"]),
      sharedWith: shares.filter((s) => s.voice_id === v.id).map((s) => ({ family: homeName(s.household_id), ...pick(s, ["policy_version", "granted_at", "revoked_at"]) })),
      consents: consents.filter((c) => c.voice_id === v.id).map((c) => pick(c, ["policy_version", "purposes", "captured_at", "revoked_at"])),
    })),
    storytellersYouApproved: approvals.map((a) => ({ voiceId: a.voice_id, kid: kidName(a.child_id), ...pick(a, ["approved_at", "revoked_at", "revoke_reason"]) })),
    recordings: sessions.map((s) => pick(s, ["recording_mode", "recorded_duration_ms", "usable_duration_ms", "recording_status", "language", "agreement_version", "created_at"])),
    voiceAgreements: [...agreements].sort((a, b) => String(a.agreed_at).localeCompare(String(b.agreed_at))).map((a) =>
      pick(a, ["agreement_version", "event", "service_rights", "readli_development_rights", "third_party_licensing", "statements", "source", "agreed_at"]),
    ),
    consentReceipts: receipts.map((r) => pick(r, ["policy_version", "purpose", "adult_owner_declared", "accepted_fields", "given_at", "revoked_at"])),
    invitationsSent: invites.map((i) => ({ family: homeName(i.household_id), ...pick(i, ["invitee_name", "relationship_label", "created_at", "expires_at", "accepted_at", "revoked_at"]) })),
    giftsGiven: giftsGiven.map((g) => pick(g, ["plan_id", "status", "recipient_name", "message", "deliver_on", "sent_at", "redeemed_at", "renewals_stopped", "created_at"])),
    giftsReceived: giftsReceived.map((g) => pick(g, ["plan_id", "status", "giver_display_name", "message", "redeemed_at", "created_at"])),
    rewards: { activities: rewards.map((r) => pick(r, ["activity", "completed_at"])), referralCode: (referral[0]?.code as string) ?? null },
  };
}

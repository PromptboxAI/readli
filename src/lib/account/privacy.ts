import type { SupabaseClient } from "@supabase/supabase-js";
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

export type DeletionBlocker =
  | { kind: "only_guardian"; householdId: string; householdName: string }
  | { kind: "sponsoring"; giftId: string; recipientName: string };

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

/**
 * What has to happen before the account can go. Leaving a shared family's kids with no grown-up in
 * charge, or a gift subscription still renewing on the account, needs the grown-up's own choice.
 */
export async function deletionBlockers(db: SupabaseClient, userId: string): Promise<DeletionBlocker[]> {
  return (await assess(db, userId)).blockers;
}

async function assess(db: SupabaseClient, userId: string): Promise<Homes> {
  const homes = await homesOf(db, userId);
  const blockers = homes.blockers;
  const [gifts, plans] = await Promise.all([
    rows(db.from("gifts").select("id, plan_id, recipient_name, status, renewals_stopped").eq("giver_id", userId), "read gifts"),
    rows(db.from("gift_plans").select("id, kind"), "read gift plans"),
  ]);
  const recurring = new Set(plans.filter((p) => p.kind === "recurring").map((p) => p.id));
  for (const g of gifts) {
    const live = ["awaiting_payment", "scheduled", "sent", "active"].includes(g.status as string);
    if (live && !g.renewals_stopped && recurring.has(g.plan_id)) {
      blockers.push({ kind: "sponsoring", giftId: g.id as string, recipientName: g.recipient_name as string });
    }
  }
  return homes;
}

async function removeObjects(db: SupabaseClient, bucket: string, keys: string[]): Promise<number> {
  for (let i = 0; i < keys.length; i += 100) {
    const { error } = await db.storage.from(bucket).remove(keys.slice(i, i + 100));
    if (error) throw new Error(`remove ${bucket} audio: ${error.message}`);
  }
  return keys.length;
}

/** Every file under `${folder}/` in a bucket, so uploads without a database row are found too. */
async function folderKeys(db: SupabaseClient, bucket: string, folder: string): Promise<string[]> {
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
 * Deletes a grown-up's account, in an order that can be safely retried if any step fails:
 * 1. their cloned voices at the voice provider (ElevenLabs), so nothing can speak in their voice again;
 * 2. every recording of them (including takes whose clone failed), every audio file made from
 *    their voice in any family, and their profile photo, from storage;
 * 3. families only they belong to, with those families' kids profiles;
 * 4. the sign-in itself, which removes the rest of their rows (profile, voices, memberships,
 *    guardianships, consents, invitations, rewards) through the database's cascades.
 * In families they share, their approvals end with them, and the family carries on.
 */
export async function deleteAccount(
  deps: { db: SupabaseClient; provider: VoiceProvider | null; refs: ProviderRefCipher | null },
  userId: string,
): Promise<DeletionResult> {
  const { db, provider, refs } = deps;
  const { solo, blockers } = await assess(db, userId);
  if (blockers.length) return { deleted: false, blockers, voicesRemoved: 0, audioFilesRemoved: 0 };

  const voices = await rows(db.from("voice_profiles").select("id, provider_voice_id_encrypted").eq("owner_id", userId), "read voices");
  const cloned = voices.filter((v) => typeof v.provider_voice_id_encrypted === "string" && v.provider_voice_id_encrypted);
  if (cloned.length && (!provider || !refs)) {
    throw new AccountError(503, "voice_provider_off", "We can't reach our voice service right now, so your account hasn't been deleted. Please try again later.");
  }
  for (const v of cloned) await provider!.deleteVoice(refs!.decrypt(v.provider_voice_id_encrypted as string));

  let audioFilesRemoved = 0;
  const voiceIds = ids(voices);
  if (voiceIds.length) {
    const libraries = await rows(db.from("narration_libraries").select("key").in("voice_id", voiceIds), "read narration libraries");
    const segments = libraries.length
      ? await rows(db.from("narration_segments").select("storage_key").in("library_key", ids(libraries, "key")), "read narration audio")
      : [];
    const assets = await rows(db.from("narration_assets").select("storage_key").in("voice_id", voiceIds), "read older narration audio");
    audioFilesRemoved += await removeObjects(db, NARRATION_BUCKETS.segments, keysOf(segments));
    audioFilesRemoved += await removeObjects(db, NARRATION_BUCKETS.assets, keysOf(assets));
  }
  const sessions = await rows(db.from("voice_training_sessions").select("id").eq("owner_id", userId), "read recording sessions");
  const takes = sessions.length
    ? await rows(db.from("voice_training_segments").select("storage_key").in("session_id", ids(sessions)), "read recordings")
    : [];
  const recordings = new Set([...keysOf(takes), ...(await folderKeys(db, RECORDINGS_BUCKET, userId))]);
  audioFilesRemoved += await removeObjects(db, RECORDINGS_BUCKET, [...recordings]);
  await removeObjects(db, PHOTOS_BUCKET, await folderKeys(db, PHOTOS_BUCKET, userId));

  await run(
    db
      .from("child_voice_approvals")
      .update({ revoked_at: new Date().toISOString(), revoked_by: userId, revoke_reason: "guardian_removed" })
      .eq("approved_by", userId)
      .is("revoked_at", null),
    "end approvals",
  );
  if (solo.length) await run(db.from("households").delete().in("id", solo), "delete families");

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new Error(`delete sign-in: ${error.message}`);
  return { deleted: true, blockers: [], voicesRemoved: cloned.length, audioFilesRemoved };
}

function keysOf(list: Row[]): string[] {
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
  const [profile, memberships, voices, receipts, sessions, invites, giftsGiven, giftsReceived, rewards, referral, approvals] = await Promise.all([
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
    recordings: sessions.map((s) => pick(s, ["recording_mode", "recorded_duration_ms", "usable_duration_ms", "recording_status", "created_at"])),
    consentReceipts: receipts.map((r) => pick(r, ["policy_version", "purpose", "adult_owner_declared", "accepted_fields", "given_at", "revoked_at"])),
    invitationsSent: invites.map((i) => ({ family: homeName(i.household_id), ...pick(i, ["invitee_name", "relationship_label", "created_at", "expires_at", "accepted_at", "revoked_at"]) })),
    giftsGiven: giftsGiven.map((g) => pick(g, ["plan_id", "status", "recipient_name", "message", "deliver_on", "sent_at", "redeemed_at", "renewals_stopped", "created_at"])),
    giftsReceived: giftsReceived.map((g) => pick(g, ["plan_id", "status", "giver_display_name", "message", "redeemed_at", "created_at"])),
    rewards: { activities: rewards.map((r) => pick(r, ["activity", "completed_at"])), referralCode: (referral[0]?.code as string) ?? null },
  };
}

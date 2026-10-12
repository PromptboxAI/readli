import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { folderKeys, keysOf, NARRATION_BUCKETS, PREVIEWS_BUCKET, RECORDINGS_BUCKET, removeObjects } from "@/lib/account/privacy";
import { fileExtension } from "@/lib/audio/mime";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";
import { VOICE_CONSENT_VERSION, VOICE_CONSENTS } from "@/lib/content/voice-consents";
import type { ServerConfig } from "@/lib/server/config";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { baseMimeType, checkUpload, SERVER_QC_MESSAGES, type QcLimits } from "@/lib/server/recording-qc";
import { ElevenLabsProvider } from "./elevenlabs";
import { VoiceProviderError, type SynthesizedAudio, type VoiceProvider } from "./provider";
import { StubVoiceProvider } from "./stub";

/**
 * A signed-in grown-up's own Readli voice (parents backend, piece 2): record with the teleprompter,
 * consent, clone, save. One voice per person; recording again replaces the provider voice on the
 * same row, so families it is shared with keep it. Deleting it removes the voice everywhere, and the
 * owner can record a new one whenever they like. Server-only: the provider voice id never leaves.
 */

export interface AccountVoice {
  id: string;
  status: "processing" | "ready" | "deleted";
  /** Bumps on every re-recording; narration libraries are kept per version. */
  version: number;
  updatedAt: string;
}

export interface TakeUpload {
  audio: Blob;
  durationMs: number;
  wpm: number | null;
  pauseCount: number;
  deviceClass: "phone" | "tablet" | "desktop" | null;
  scriptOffsetEnd: number | null;
  /** The consent statements the person ticked, verbatim. */
  consents: readonly string[];
  removeBackgroundNoise: boolean;
}

export interface SavedTake {
  storageKey: string;
  consentReceiptId: string;
}

/** Persistence for account voices. Supabase in production, memory in tests and stub mode. */
export interface AccountVoiceStore {
  findVoice(ownerId: string): Promise<(AccountVoice & { providerVoiceId: string | null }) | null>;
  saveTake(owner: { id: string; name: string }, take: TakeUpload, policyVersion: string): Promise<SavedTake>;
  /** Creates or replaces the owner's voice row and records their consent against it. */
  saveVoice(owner: { id: string; name: string }, providerVoiceId: string, take: TakeUpload, saved: SavedTake): Promise<AccountVoice>;
  providerVoiceId(voiceId: string): Promise<string | null>;
  /**
   * Removes everything kept for the owner's voice except the record that it existed: their
   * recordings, audio made from the voice, sharing and kids' approvals. Safe to retry.
   */
  removeVoice(ownerId: string, voiceId: string): Promise<void>;
}

export class AccountVoiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly userMessage: string,
  ) {
    super(userMessage);
  }
}

export const SAMPLE_TEXT =
  "Once upon a time, in a cozy little house, someone very special settled into the big chair and opened a story, just for you.";

export interface AccountVoiceDeps {
  store: AccountVoiceStore;
  provider: VoiceProvider;
  limits: QcLimits;
}

/** Checks the take and consent, saves the recording, clones it and saves the voice. */
export async function createAccountVoice(deps: AccountVoiceDeps, owner: { id: string; name: string }, take: TakeUpload): Promise<AccountVoice> {
  if (!VOICE_CONSENTS.every((c) => take.consents.includes(c))) {
    throw new AccountVoiceError(400, "consent_required", "Please agree to each point before we make your voice.");
  }
  const issues = checkUpload({ mimeType: take.audio.type, bytes: take.audio.size, durationMs: take.durationMs }, deps.limits);
  if (issues.length > 0) throw new AccountVoiceError(422, issues[0]!, SERVER_QC_MESSAGES[issues[0]!]);

  const saved = await deps.store.saveTake(owner, take, VOICE_CONSENT_VERSION);
  const previous = await deps.store.findVoice(owner.id);
  let providerVoiceId: string;
  try {
    ({ voiceId: providerVoiceId } = await deps.provider.createInstantVoice({
      name: `Readli voice ${owner.id.slice(0, 8)}`,
      audio: take.audio,
      filename: `take.${fileExtension(take.audio.type)}`,
      description: "Readli family voice. Private to its owner until they share it.",
      removeBackgroundNoise: take.removeBackgroundNoise,
    }));
  } catch (err) {
    console.error("account voice clone failed", err);
    const message = err instanceof VoiceProviderError ? err.userMessage : "We couldn't make your voice just now. Please try again.";
    throw new AccountVoiceError(502, "clone_failed", message);
  }
  const voice = await deps.store.saveVoice(owner, providerVoiceId, take, saved);
  // A new recording replaces the old provider voice straight away.
  if (previous?.providerVoiceId && previous.providerVoiceId !== providerVoiceId) {
    await deps.provider.deleteVoice(previous.providerVoiceId).catch((err) => console.error("old account voice delete failed", err));
  }
  return voice;
}

/**
 * Deletes the owner's voice: first at the voice provider, so nothing can speak in it again, then
 * everything Readli kept. Families it was shared with lose it at once. Recording again makes a new voice.
 */
export async function deleteAccountVoice(deps: AccountVoiceDeps, ownerId: string): Promise<void> {
  const voice = await deps.store.findVoice(ownerId);
  if (!voice) throw new AccountVoiceError(404, "no_voice", "You don't have a Readli voice to delete.");
  if (voice.providerVoiceId) {
    try {
      await deps.provider.deleteVoice(voice.providerVoiceId);
    } catch (err) {
      console.error("account voice delete failed", err);
      throw new AccountVoiceError(502, "delete_failed", "We couldn't delete your voice just now, so nothing has changed. Please try again.");
    }
  }
  await deps.store.removeVoice(ownerId, voice.id);
}

/** A short line in the owner's voice, for "Does this sound like you?". Only the owner can hear it. */
export async function accountVoiceSample(deps: AccountVoiceDeps, ownerId: string): Promise<SynthesizedAudio> {
  const voice = await deps.store.findVoice(ownerId);
  if (!voice?.providerVoiceId || voice.status !== "ready") {
    throw new AccountVoiceError(404, "no_voice", "Record your voice first, then you can hear a sample.");
  }
  return deps.provider.synthesize({ voiceId: voice.providerVoiceId, text: SAMPLE_TEXT });
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export class MemoryAccountVoiceStore implements AccountVoiceStore {
  readonly voices = new Map<string, AccountVoice & { ownerId: string; providerVoiceId: string | null }>();
  readonly receipts: { id: string; ownerId: string; statements: readonly string[]; removeBackgroundNoise: boolean }[] = [];
  readonly takes: { key: string; ownerId: string; bytes: number }[] = [];

  private entry(ownerId: string) {
    return [...this.voices.values()].find((v) => v.ownerId === ownerId && v.status !== "deleted") ?? null;
  }

  async findVoice(ownerId: string) {
    const v = this.entry(ownerId);
    return v ? { ...v } : null;
  }

  async saveTake(owner: { id: string }, take: TakeUpload) {
    const key = `${owner.id}/${randomUUID()}.${fileExtension(take.audio.type)}`;
    this.takes.push({ key, ownerId: owner.id, bytes: take.audio.size });
    const id = randomUUID();
    this.receipts.push({ id, ownerId: owner.id, statements: take.consents, removeBackgroundNoise: take.removeBackgroundNoise });
    return { storageKey: key, consentReceiptId: id };
  }

  async saveVoice(owner: { id: string }, providerVoiceId: string) {
    const at = new Date().toISOString();
    const existing = this.entry(owner.id);
    if (existing) {
      Object.assign(existing, { providerVoiceId, status: "ready", updatedAt: at, version: existing.version + 1 });
      return { id: existing.id, status: existing.status, version: existing.version, updatedAt: at };
    }
    const id = randomUUID();
    this.voices.set(id, { id, ownerId: owner.id, providerVoiceId, status: "ready", updatedAt: at, version: 1 });
    return { id, status: "ready" as const, version: 1, updatedAt: at };
  }

  async providerVoiceId(voiceId: string) {
    return this.voices.get(voiceId)?.providerVoiceId ?? null;
  }

  async removeVoice(ownerId: string, voiceId: string) {
    const v = this.voices.get(voiceId);
    if (v?.ownerId === ownerId) Object.assign(v, { status: "deleted", providerVoiceId: null, updatedAt: new Date().toISOString() });
    for (let i = this.takes.length - 1; i >= 0; i--) if (this.takes[i]!.ownerId === ownerId) this.takes.splice(i, 1);
  }
}

const BUCKET = RECORDINGS_BUCKET;
type Row = Record<string, unknown>;

export class SupabaseAccountVoiceStore implements AccountVoiceStore {
  private readonly cipher: ProviderRefCipher;
  private scriptVersionId: string | null = null;

  constructor(
    private readonly db: SupabaseClient,
    secret: string,
  ) {
    this.cipher = new ProviderRefCipher(secret);
  }

  private async q<T = Row>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(`${what}: ${error.message}`);
    return data as T;
  }

  async findVoice(ownerId: string) {
    const row = await this.q<Row | null>(
      this.db
        .from("voice_profiles")
        .select("id, status, version, updated_at, provider_voice_id_encrypted")
        .eq("owner_id", ownerId)
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "find account voice",
    );
    if (!row) return null;
    const enc = row.provider_voice_id_encrypted as string | null;
    return {
      id: row.id as string,
      status: row.status as AccountVoice["status"],
      version: Number(row.version ?? 1),
      updatedAt: row.updated_at as string,
      providerVoiceId: enc ? this.cipher.decrypt(enc) : null,
    };
  }

  // The family script reads the same words as the published guest script for now.
  private async scriptVersion(): Promise<string> {
    if (this.scriptVersionId) return this.scriptVersionId;
    const row = await this.q(
      this.db.from("voice_script_versions").select("id, voice_scripts!inner(slug)").eq("voice_scripts.slug", "guest_short.en").lte("version", DEMO_SCRIPT.version).order("version", { ascending: false }).limit(1).single(),
      "find script version",
    );
    this.scriptVersionId = row.id as string;
    return this.scriptVersionId;
  }

  async saveTake(owner: { id: string }, take: TakeUpload, policyVersion: string) {
    const mimeType = baseMimeType(take.audio.type);
    const key = `${owner.id}/${randomUUID()}.${fileExtension(mimeType)}`;
    const { error } = await this.db.storage.from(BUCKET).upload(key, new Blob([take.audio], { type: mimeType }), { contentType: mimeType, upsert: false });
    if (error) throw new Error(`upload account recording: ${error.message}`);
    const receipt = await this.q(
      this.db
        .from("consent_receipts")
        .insert({
          user_id: owner.id,
          policy_version: policyVersion,
          purpose: "voice_persistence",
          adult_owner_declared: true,
          accepted_fields: { statements: take.consents, remove_background_noise: take.removeBackgroundNoise },
        })
        .select("id")
        .single(),
      "save consent receipt",
    );
    return { storageKey: key, consentReceiptId: receipt.id as string };
  }

  // The family-facing name lives on adult_profiles; the sign-in name is only a fallback.
  private async displayName(owner: { id: string; name: string }): Promise<string> {
    const row = await this.q<Row | null>(this.db.from("adult_profiles").select("display_name").eq("user_id", owner.id).maybeSingle(), "read display name");
    return (row?.display_name as string | undefined) ?? owner.name;
  }

  async saveVoice(owner: { id: string; name: string }, providerVoiceId: string, take: TakeUpload, saved: SavedTake) {
    const at = new Date().toISOString();
    const encrypted = this.cipher.encrypt(providerVoiceId);
    const existing = await this.findVoice(owner.id);
    const row = existing
      ? await this.q(
          this.db
            .from("voice_profiles")
            .update({ provider_voice_id_encrypted: encrypted, status: "ready", version: existing.version + 1, updated_at: at })
            .eq("id", existing.id)
            .select("id, status, version, updated_at")
            .single(),
          "replace account voice",
        )
      : await this.q(
          this.db
            .from("voice_profiles")
            .insert({ owner_id: owner.id, display_name: await this.displayName(owner), clone_type: "instant", provider: "elevenlabs", provider_voice_id_encrypted: encrypted, status: "ready" })
            .select("id, status, version, updated_at")
            .single(),
          "save account voice",
        );
    const voiceId = row.id as string;
    await this.q(
      this.db.from("voice_consents").insert({
        voice_id: voiceId,
        owner_id: owner.id,
        policy_version: VOICE_CONSENT_VERSION,
        purposes: ["create", "narrate_for_shared_families"],
        recording_proof_ref: saved.storageKey,
      }),
      "save voice consent",
    );
    const session = await this.q(
      this.db
        .from("voice_training_sessions")
        .insert({
          owner_id: owner.id,
          voice_profile_id: voiceId,
          recording_mode: "family_short",
          script_version_id: await this.scriptVersion(),
          script_offset_end: take.scriptOffsetEnd,
          teleprompter_speed: take.wpm,
          recorded_duration_ms: Math.round(take.durationMs),
          usable_duration_ms: Math.round(take.durationMs),
          pause_events_count: take.pauseCount,
          device_class: take.deviceClass,
          audio_qc_status: "passed",
          recording_status: "accepted",
          consent_receipt_id: saved.consentReceiptId,
        })
        .select("id")
        .single(),
      "save recording session",
    );
    await this.q(
      this.db.from("voice_training_segments").insert({
        session_id: session.id,
        ordinal: 0,
        storage_key: saved.storageKey,
        mime_type: baseMimeType(take.audio.type),
        duration_ms: Math.round(take.durationMs),
        usable_duration_ms: Math.round(take.durationMs),
        script_offset_start: 0,
        script_offset_end: take.scriptOffsetEnd ?? 0,
        audio_qc_status: "passed",
      }),
      "save recording segment",
    );
    return { id: voiceId, status: row.status as AccountVoice["status"], version: Number(row.version ?? 1), updatedAt: row.updated_at as string };
  }

  async providerVoiceId(voiceId: string) {
    const row = await this.q<Row | null>(
      this.db.from("voice_profiles").select("provider_voice_id_encrypted").eq("id", voiceId).neq("status", "deleted").maybeSingle(),
      "read provider voice",
    );
    const enc = row?.provider_voice_id_encrypted as string | null | undefined;
    return enc ? this.cipher.decrypt(enc) : null;
  }

  async removeVoice(ownerId: string, voiceId: string) {
    const at = new Date().toISOString();
    const db = this.db;
    // Audio made from the voice, in every family, then every recording of the owner.
    const libraries = await this.q<Row[]>(db.from("narration_libraries").select("key").eq("voice_id", voiceId), "read narration libraries");
    const segments = libraries.length
      ? await this.q<Row[]>(db.from("narration_segments").select("storage_key").in("library_key", libraries.map((l) => l.key as string)), "read narration audio")
      : [];
    const assets = await this.q<Row[]>(db.from("narration_assets").select("storage_key").eq("voice_id", voiceId), "read older narration audio");
    await removeObjects(db, NARRATION_BUCKETS.segments, keysOf(segments));
    await removeObjects(db, NARRATION_BUCKETS.assets, keysOf(assets));
    const sessions = await this.q<Row[]>(db.from("voice_training_sessions").select("id").eq("owner_id", ownerId), "read recording sessions");
    const takes = sessions.length
      ? await this.q<Row[]>(db.from("voice_training_segments").select("storage_key").in("session_id", sessions.map((x) => x.id as string)), "read recordings")
      : [];
    await removeObjects(db, BUCKET, [...new Set([...keysOf(takes), ...(await folderKeys(db, BUCKET, ownerId))])]);
    // Family-invitation previews were read in this voice.
    await removeObjects(db, PREVIEWS_BUCKET, await folderKeys(db, PREVIEWS_BUCKET, ownerId));
    await this.q(db.from("voice_previews").update({ retired_at: at }).eq("owner_id", ownerId).is("retired_at", null), "retire invitation previews");

    // Kids lose it first (so the reason reads "voice deleted"), then families, which frees their narrator slots.
    await this.q(
      db.from("child_voice_approvals").update({ revoked_at: at, revoked_by: ownerId, revoke_reason: "voice_deleted" }).eq("voice_id", voiceId).is("revoked_at", null),
      "end kids approvals",
    );
    await this.q(db.from("voice_household_shares").update({ revoked_at: at, revoked_by: ownerId }).eq("voice_id", voiceId).is("revoked_at", null), "stop sharing");
    await this.q(db.from("voice_consents").update({ revoked_at: at }).eq("voice_id", voiceId).is("revoked_at", null), "withdraw voice consent");
    // Library rows stay for credit history; their audio is gone and a deleted voice is never offered.
    if (libraries.length) {
      await this.q(
        db.from("narration_jobs").update({ status: "canceled", finished_at: at }).in("library_key", libraries.map((l) => l.key as string)).in("status", ["queued", "running"]),
        "stop narration in progress",
      );
    }
    await this.q(
      db.from("voice_profiles").update({ status: "deleted", deleted_at: at, updated_at: at, provider_voice_id_encrypted: null }).eq("id", voiceId).eq("owner_id", ownerId),
      "delete account voice",
    );
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const g = globalThis as typeof globalThis & { __readliAccountVoices?: { store: MemoryAccountVoiceStore; provider: StubVoiceProvider } };

/** Store and provider for the current mode; null when account voices can't be made here. */
export function accountVoiceDeps(config: ServerConfig): AccountVoiceDeps | null {
  // A real voice needs a real minute; the guest test override doesn't apply to accounts.
  const limits = { ...config, minRecordingMs: Math.max(config.minRecordingMs, 59_000) };
  if (config.mode === "stub") {
    g.__readliAccountVoices ??= { store: new MemoryAccountVoiceStore(), provider: new StubVoiceProvider() };
    return { ...g.__readliAccountVoices, limits: config };
  }
  if (config.mode === "live" && config.supabaseUrl && config.supabaseServiceKey && config.cookieSecret) {
    const db = createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return {
      store: new SupabaseAccountVoiceStore(db, config.cookieSecret),
      provider: new ElevenLabsProvider(config.elevenLabsKey!, config.elevenLabsModel),
      limits,
    };
  }
  return null;
}

/** Server-only: the provider voice behind a Readli voice, for narration. Never send this to a browser. */
export async function providerVoiceId(deps: AccountVoiceDeps, voiceId: string): Promise<string | null> {
  return deps.store.providerVoiceId(voiceId);
}

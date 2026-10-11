import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RECORDINGS_BUCKET } from "@/lib/account/privacy";
import { fileExtension } from "@/lib/audio/mime";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";
import { VOICE_CONSENT_VERSION } from "@/lib/content/voice-consents";
import type { ServerConfig } from "@/lib/server/config";
import { ProviderRefCipher } from "@/lib/server/provider-ref";
import { baseMimeType, checkUpload, SERVER_QC_MESSAGES, type QcLimits } from "@/lib/server/recording-qc";
import { agreementInForce, MemoryVoiceAgreementStore, SupabaseVoiceAgreementStore, VoiceAgreementError, type VoiceAgreement, type VoiceAgreementStore } from "./agreements";
import { ElevenLabsProvider } from "./elevenlabs";
import { VoiceProviderError, type SynthesizedAudio, type VoiceProvider } from "./provider";
import { StubVoiceProvider } from "./stub";

/**
 * A signed-in grown-up's own Readli voice (parents backend, piece 2): record with the teleprompter,
 * consent, clone, save. One voice per person; recording again replaces the provider voice on the
 * same row and bumps its version, so families it is shared with keep it and finished books keep the
 * audio of the version they were made with. Deleting it withdraws the voice: nothing new is made in
 * it, its provider clone is retired, unfinished narration stops (with credits returned) and its
 * recordings leave all training, but stories already prepared keep playing for the families it was
 * shared with. Only a legally required removal takes those (src/lib/lifecycle/legal-removal.ts).
 * The owner can record a new voice whenever they like. Server-only: the provider voice id never leaves.
 */

export interface AccountVoice {
  id: string;
  status: "processing" | "ready" | "withdrawn" | "deleted";
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
  /** The Voice Recording & AI Training Agreement they accepted before the microphone started. */
  agreementId: string | null;
  removeBackgroundNoise: boolean;
  /** What the recorder measured, kept with the recording. */
  qc: { speechMs: number | null; issues: readonly string[] } | null;
  userAgent: string | null;
}

/** The take with its agreement checked, as the store saves it. */
export interface AgreedTake extends TakeUpload {
  agreement: VoiceAgreement;
}

export interface SavedTake {
  storageKey: string;
  consentReceiptId: string;
}

/** Persistence for account voices. Supabase in production, memory in tests and stub mode. */
export interface AccountVoiceStore {
  findVoice(ownerId: string): Promise<(AccountVoice & { providerVoiceId: string | null }) | null>;
  saveTake(owner: { id: string; name: string }, take: AgreedTake, policyVersion: string): Promise<SavedTake>;
  /** Creates or replaces the owner's voice row and records their consent against it. */
  saveVoice(owner: { id: string; name: string }, providerVoiceId: string, take: AgreedTake, saved: SavedTake): Promise<AccountVoice>;
  providerVoiceId(voiceId: string): Promise<string | null>;
  /**
   * The owner deleted their voice: marks it withdrawn (which records the withdrawal on their agreement
   * history and takes their recordings out of training), forgets the provider clone and stops
   * narration still being prepared in it, refunding unused credits. Keeps shares, kids' approvals
   * and prepared stories. Safe to retry.
   */
  withdrawVoice(ownerId: string, voiceId: string): Promise<{ stoppedJobs: number }>;
  /** A ready voice whose clone was retired: the latest original recording, if its owner's authorization is still valid. */
  recloneSource(voiceId: string): Promise<{ ownerId: string; audio: Blob; removeBackgroundNoise: boolean } | null>;
  /** Saves a re-made clone unless another worker already did; false means keep theirs. */
  restoreClone(voiceId: string, providerVoiceId: string): Promise<boolean>;
  /** Forgets a ready voice's clone (it was retired at the provider), keeping its recordings. False if it had none. */
  forgetClone(voiceId: string): Promise<boolean>;
  /** Appends to the lifecycle audit log. */
  logEvent(event: LifecycleEvent): Promise<void>;
}

export interface LifecycleEvent {
  actor: string;
  action: "voice_withdrawn" | "voice_version_upgraded" | "clone_created" | "clone_retired" | "clone_reactivated";
  voiceId: string;
  detail?: Record<string, unknown>;
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
  agreements: VoiceAgreementStore;
  provider: VoiceProvider;
  limits: QcLimits;
}

/** Checks the take and consent, saves the recording, clones it and saves the voice. */
export async function createAccountVoice(deps: AccountVoiceDeps, owner: { id: string; name: string }, take: TakeUpload): Promise<AccountVoice> {
  let agreement: VoiceAgreement;
  try {
    agreement = await agreementInForce(deps.agreements, owner.id, take.agreementId);
  } catch (err) {
    if (err instanceof VoiceAgreementError) throw new AccountVoiceError(err.status, "consent_required", err.userMessage);
    throw err;
  }
  const issues = checkUpload({ mimeType: take.audio.type, bytes: take.audio.size, durationMs: take.durationMs }, deps.limits);
  if (issues.length > 0) throw new AccountVoiceError(422, issues[0]!, SERVER_QC_MESSAGES[issues[0]!]);

  const agreed: AgreedTake = { ...take, agreement };
  const saved = await deps.store.saveTake(owner, agreed, VOICE_CONSENT_VERSION);
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
  const voice = await deps.store.saveVoice(owner, providerVoiceId, agreed, saved);
  // A new recording replaces the old provider voice straight away; books already made keep their audio.
  if (previous?.providerVoiceId && previous.providerVoiceId !== providerVoiceId) {
    await deps.provider.deleteVoice(previous.providerVoiceId).catch((err) => console.error("old account voice delete failed", err));
  }
  await deps.store
    .logEvent(
      previous
        ? { actor: owner.id, action: "voice_version_upgraded", voiceId: voice.id, detail: { from: previous.version, to: voice.version } }
        : { actor: owner.id, action: "clone_created", voiceId: voice.id, detail: { version: voice.version } },
    )
    .catch((err) => console.error("voice lifecycle log failed", err));
  return voice;
}

/** The script text read up to where the speaker stopped: the recording's expected transcript. */
export function expectedTranscript(scriptOffsetEnd: number | null): string {
  const text = DEMO_SCRIPT.paragraphs.join(" ");
  return scriptOffsetEnd === null ? text : text.slice(0, Math.max(0, scriptOffsetEnd));
}

/** What the owner's consent on a voice covers, from the rights they granted. */
export function consentPurposes(agreement: VoiceAgreement): string[] {
  return [
    "create",
    "narrate_for_shared_families",
    ...(agreement.rights.readliDevelopment ? ["readli_development"] : []),
    ...(agreement.rights.thirdPartyLicensing ? ["third_party_licensing"] : []),
  ];
}

/**
 * Deletes (withdraws) the owner's voice: first the clone at the voice provider, so nothing new can be
 * made in it, then it stops being offered as a narrator, unfinished narration stops with its credits
 * returned, and the withdrawal is recorded, which takes the recordings out of all future training.
 * Stories already prepared keep playing for the families it was shared with. Recording again makes a
 * new voice under a new agreement.
 */
export async function deleteAccountVoice(deps: AccountVoiceDeps, ownerId: string): Promise<{ stoppedJobs: number }> {
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
  const result = await deps.store.withdrawVoice(ownerId, voice.id);
  await deps.store
    .logEvent({ actor: ownerId, action: "voice_withdrawn", voiceId: voice.id, detail: { stopped_jobs: result.stoppedJobs, clone_retired: Boolean(voice.providerVoiceId) } })
    .catch((err) => console.error("voice lifecycle log failed", err));
  return result;
}

/**
 * Retires the provider clone of a voice no Readli Family household has needed for a while (the lifecycle
 * job decides). Playback of stored stories never needs it, and the original recording stays, so
 * ensureClone can make it again if a Family household needs the voice and the authorization holds.
 */
export async function retireUnusedClone(deps: AccountVoiceDeps, voiceId: string): Promise<boolean> {
  const id = await deps.store.providerVoiceId(voiceId);
  if (!id) return false;
  await deps.provider.deleteVoice(id);
  return deps.store.forgetClone(voiceId);
}

/**
 * The provider voice for a ready Readli voice, re-cloning it from the stored original recording if its
 * clone was retired (no Readli Family household needed it for a while). Only while the owner's
 * authorization is still in force; a withdrawn or deleted voice is never re-made.
 */
export async function ensureClone(deps: AccountVoiceDeps, voiceId: string): Promise<string> {
  const existing = await deps.store.providerVoiceId(voiceId);
  if (existing) return existing;
  const source = await deps.store.recloneSource(voiceId);
  if (!source) throw new AccountVoiceError(409, "voice_unavailable", "This storyteller's voice can't be used for new stories right now.");
  let made: string;
  try {
    ({ voiceId: made } = await deps.provider.createInstantVoice({
      name: `Readli voice ${source.ownerId.slice(0, 8)}`,
      audio: source.audio,
      filename: `take.${fileExtension(source.audio.type)}`,
      description: "Readli family voice, restored from its original recording.",
      removeBackgroundNoise: source.removeBackgroundNoise,
    }));
  } catch (err) {
    console.error("voice re-clone failed", err);
    throw new AccountVoiceError(502, "clone_failed", "We couldn't get this storyteller's voice ready just now. Please try again.");
  }
  if (!(await deps.store.restoreClone(voiceId, made))) {
    // Another request restored it first; keep theirs.
    await deps.provider.deleteVoice(made).catch((err) => console.error("duplicate re-clone delete failed", err));
    const theirs = await deps.store.providerVoiceId(voiceId);
    if (!theirs) throw new AccountVoiceError(409, "voice_unavailable", "This storyteller's voice can't be used for new stories right now.");
    return theirs;
  }
  await deps.store.logEvent({ actor: "system", action: "clone_reactivated", voiceId }).catch((err) => console.error("voice lifecycle log failed", err));
  return made;
}

/** A short line in the owner's voice, for "Does this sound like you?". Only the owner can hear it. */
export async function accountVoiceSample(deps: AccountVoiceDeps, ownerId: string): Promise<SynthesizedAudio> {
  const voice = await deps.store.findVoice(ownerId);
  if (!voice || voice.status !== "ready") {
    throw new AccountVoiceError(404, "no_voice", "Record your voice first, then you can hear a sample.");
  }
  const providerId = voice.providerVoiceId ?? (await ensureClone(deps, voice.id));
  return deps.provider.synthesize({ voiceId: providerId, text: SAMPLE_TEXT });
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export class MemoryAccountVoiceStore implements AccountVoiceStore {
  readonly voices = new Map<string, AccountVoice & { ownerId: string; providerVoiceId: string | null; cloneRetiredAt?: string | null }>();
  readonly receipts: { id: string; ownerId: string; agreementId: string; removeBackgroundNoise: boolean }[] = [];
  readonly takes: { key: string; ownerId: string; voiceId?: string; bytes: number; agreementId: string; language: string; transcript: string; audio?: Blob; excludedFromTraining?: boolean }[] = [];
  readonly events: LifecycleEvent[] = [];
  /** Narration jobs to stop when a voice is withdrawn; tests wire this to a family store. */
  onWithdraw: (voiceId: string) => Promise<number> = async () => 0;
  /** Whether the owner's authorization is still in force, for re-cloning; tests can turn it off. */
  authorized: (ownerId: string) => boolean = () => true;

  private entry(ownerId: string) {
    return [...this.voices.values()].find((v) => v.ownerId === ownerId && (v.status === "ready" || v.status === "processing")) ?? null;
  }

  async findVoice(ownerId: string) {
    const v = this.entry(ownerId);
    return v ? { ...v } : null;
  }

  async saveTake(owner: { id: string }, take: AgreedTake) {
    const key = `${owner.id}/${randomUUID()}.${fileExtension(take.audio.type)}`;
    this.takes.push({
      key,
      ownerId: owner.id,
      audio: take.audio,
      bytes: take.audio.size,
      agreementId: take.agreement.id,
      language: DEMO_SCRIPT.locale,
      transcript: expectedTranscript(take.scriptOffsetEnd),
    });
    const id = randomUUID();
    this.receipts.push({ id, ownerId: owner.id, agreementId: take.agreement.id, removeBackgroundNoise: take.removeBackgroundNoise });
    return { storageKey: key, consentReceiptId: id };
  }

  async saveVoice(owner: { id: string }, providerVoiceId: string, _take: AgreedTake, saved: SavedTake) {
    const at = new Date().toISOString();
    const existing = this.entry(owner.id);
    const take = this.takes.find((t) => t.key === saved.storageKey);
    if (existing) {
      Object.assign(existing, { providerVoiceId, status: "ready", updatedAt: at, version: existing.version + 1, cloneRetiredAt: null });
      if (take) take.voiceId = existing.id;
      return { id: existing.id, status: existing.status, version: existing.version, updatedAt: at };
    }
    const id = randomUUID();
    this.voices.set(id, { id, ownerId: owner.id, providerVoiceId, status: "ready", updatedAt: at, version: 1 });
    if (take) take.voiceId = id;
    return { id, status: "ready" as const, version: 1, updatedAt: at };
  }

  async providerVoiceId(voiceId: string) {
    const v = this.voices.get(voiceId);
    return v?.status === "ready" || v?.status === "processing" ? v.providerVoiceId : null;
  }

  async withdrawVoice(ownerId: string, voiceId: string) {
    const v = this.voices.get(voiceId);
    if (v?.ownerId !== ownerId) return { stoppedJobs: 0 };
    const at = new Date().toISOString();
    if (v.status !== "withdrawn") Object.assign(v, { status: "withdrawn", providerVoiceId: null, cloneRetiredAt: at, updatedAt: at });
    for (const t of this.takes) if (t.voiceId === voiceId) t.excludedFromTraining = true;
    return { stoppedJobs: await this.onWithdraw(voiceId) };
  }

  /** Test hook: retires a ready voice's clone without the provider call. */
  retireClone(voiceId: string) {
    void this.forgetClone(voiceId);
  }

  async forgetClone(voiceId: string) {
    const v = this.voices.get(voiceId);
    if (v?.status !== "ready" || !v.providerVoiceId) return false;
    Object.assign(v, { providerVoiceId: null, cloneRetiredAt: new Date().toISOString() });
    return true;
  }

  async recloneSource(voiceId: string) {
    const v = this.voices.get(voiceId);
    if (!v || v.status !== "ready" || !this.authorized(v.ownerId)) return null;
    const take = [...this.takes].reverse().find((t) => t.voiceId === voiceId && t.audio && !t.excludedFromTraining);
    return take ? { ownerId: v.ownerId, audio: take.audio!, removeBackgroundNoise: false } : null;
  }

  async restoreClone(voiceId: string, providerVoiceId: string) {
    const v = this.voices.get(voiceId);
    if (!v || v.status !== "ready" || v.providerVoiceId) return false;
    Object.assign(v, { providerVoiceId, cloneRetiredAt: null });
    return true;
  }

  async logEvent(event: LifecycleEvent) {
    this.events.push(event);
  }
}

const BUCKET = RECORDINGS_BUCKET;
/** What the recorder asks the browser for (useMicrophone), kept with each recording. */
const CAPTURE_CONSTRAINTS = { channel_count: 1, echo_cancellation: true, noise_suppression: false, auto_gain_control: false };
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
        .in("status", ["processing", "ready"])
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

  async saveTake(owner: { id: string }, take: AgreedTake, policyVersion: string) {
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
          accepted_fields: {
            agreement_id: take.agreement.id,
            rights: take.agreement.rights,
            remove_background_noise: take.removeBackgroundNoise,
          },
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

  async saveVoice(owner: { id: string; name: string }, providerVoiceId: string, take: AgreedTake, saved: SavedTake) {
    const at = new Date().toISOString();
    const encrypted = this.cipher.encrypt(providerVoiceId);
    const existing = await this.findVoice(owner.id);
    const row = existing
      ? await this.q(
          this.db
            .from("voice_profiles")
            .update({ provider_voice_id_encrypted: encrypted, status: "ready", version: existing.version + 1, updated_at: at, clone_retired_at: null })
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
        purposes: consentPurposes(take.agreement),
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
          agreement_id: take.agreement.id,
          agreement_version: take.agreement.version,
          language: DEMO_SCRIPT.locale,
          transcript: expectedTranscript(take.scriptOffsetEnd),
          transcript_source: "script",
          quality: { audio_qc_status: "passed", speech_ms: take.qc?.speechMs ?? null, issues: take.qc?.issues ?? [] },
          capture: { device_class: take.deviceClass, words_per_minute: take.wpm, user_agent: take.userAgent, constraints: CAPTURE_CONSTRAINTS },
          audio_mime_type: baseMimeType(take.audio.type),
          audio_bytes: take.audio.size,
          remove_background_noise: take.removeBackgroundNoise,
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
      this.db.from("voice_profiles").select("provider_voice_id_encrypted").eq("id", voiceId).in("status", ["processing", "ready"]).maybeSingle(),
      "read provider voice",
    );
    const enc = row?.provider_voice_id_encrypted as string | null | undefined;
    return enc ? this.cipher.decrypt(enc) : null;
  }

  async withdrawVoice(ownerId: string, voiceId: string) {
    const at = new Date().toISOString();
    const db = this.db;
    // Marking it withdrawn records the withdrawal on the owner's agreement history (a database trigger),
    // which takes every recording of it out of voice_recordings_usable and so out of training.
    await this.q(
      db
        .from("voice_profiles")
        .update({ status: "withdrawn", withdrawn_at: at, clone_retired_at: at, updated_at: at, provider_voice_id_encrypted: null })
        .eq("id", voiceId)
        .eq("owner_id", ownerId)
        .in("status", ["processing", "ready"]),
      "withdraw account voice",
    );
    await this.q(db.from("voice_consents").update({ revoked_at: at }).eq("voice_id", voiceId).is("revoked_at", null), "withdraw voice consent");
    // Unfinished narration in it, in every family, stops; credits it hadn't used go back where they came from.
    const stopped = await this.q<number | null>(db.rpc("stop_voice_narration", { p_voice: voiceId }), "stop narration in progress");
    return { stoppedJobs: Number(stopped ?? 0) };
  }

  async recloneSource(voiceId: string) {
    const db = this.db;
    const voice = await this.q<Row | null>(db.from("voice_profiles").select("owner_id, status").eq("id", voiceId).maybeSingle(), "read voice");
    if (!voice || voice.status !== "ready") return null;
    // Only recordings whose owner's authorization is still in force appear in this view.
    const usable = await this.q<Row[]>(
      db.from("voice_recordings_usable").select("session_id, storage_key, mime_type, recorded_at").eq("voice_profile_id", voiceId).order("recorded_at", { ascending: false }).limit(1),
      "find original recording",
    );
    const take = usable[0];
    if (!take) return null;
    const session = await this.q<Row | null>(db.from("voice_training_sessions").select("remove_background_noise").eq("id", take.session_id as string).maybeSingle(), "read recording");
    const { data, error } = await db.storage.from(BUCKET).download(take.storage_key as string);
    if (error || !data) throw new Error(`download original recording: ${error?.message ?? "missing"}`);
    const audio = new Blob([await data.arrayBuffer()], { type: (take.mime_type as string | null) ?? data.type });
    return { ownerId: voice.owner_id as string, audio, removeBackgroundNoise: Boolean(session?.remove_background_noise) };
  }

  async forgetClone(voiceId: string) {
    const at = new Date().toISOString();
    const rows = await this.q<Row[]>(
      this.db
        .from("voice_profiles")
        .update({ provider_voice_id_encrypted: null, clone_retired_at: at, updated_at: at })
        .eq("id", voiceId)
        .eq("status", "ready")
        .not("provider_voice_id_encrypted", "is", null)
        .select("id"),
      "retire voice clone",
    );
    return rows.length > 0;
  }

  async restoreClone(voiceId: string, providerVoiceId: string) {
    const rows = await this.q<Row[]>(
      this.db
        .from("voice_profiles")
        .update({ provider_voice_id_encrypted: this.cipher.encrypt(providerVoiceId), clone_retired_at: null, unlinked_since: null, updated_at: new Date().toISOString() })
        .eq("id", voiceId)
        .eq("status", "ready")
        .is("provider_voice_id_encrypted", null)
        .select("id"),
      "restore voice clone",
    );
    return rows.length > 0;
  }

  async logEvent(event: LifecycleEvent) {
    await this.q(
      this.db.from("lifecycle_audit_log").insert({ actor: event.actor, action: event.action, voice_id: event.voiceId, detail: event.detail ?? {} }),
      "write lifecycle log",
    );
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const g = globalThis as typeof globalThis & {
  __readliAccountVoices?: { store: MemoryAccountVoiceStore; agreements: MemoryVoiceAgreementStore; provider: StubVoiceProvider };
};

/** Store and provider for the current mode; null when account voices can't be made here. */
export function accountVoiceDeps(config: ServerConfig): AccountVoiceDeps | null {
  // A real voice needs a real minute; the guest test override doesn't apply to accounts.
  const limits = { ...config, minRecordingMs: Math.max(config.minRecordingMs, 59_000) };
  if (config.mode === "stub") {
    g.__readliAccountVoices ??= { store: new MemoryAccountVoiceStore(), agreements: new MemoryVoiceAgreementStore(), provider: new StubVoiceProvider() };
    return { ...g.__readliAccountVoices, limits: config };
  }
  if (config.mode === "live" && config.supabaseUrl && config.supabaseServiceKey && config.cookieSecret) {
    const db = createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return {
      store: new SupabaseAccountVoiceStore(db, config.cookieSecret),
      agreements: new SupabaseVoiceAgreementStore(db),
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

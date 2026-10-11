import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
 * same row, so families it is shared with keep it. Server-only: the provider voice id never leaves.
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
  // A new recording replaces the old provider voice straight away.
  if (previous?.providerVoiceId && previous.providerVoiceId !== providerVoiceId) {
    await deps.provider.deleteVoice(previous.providerVoiceId).catch((err) => console.error("old account voice delete failed", err));
  }
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
  readonly receipts: { id: string; ownerId: string; agreementId: string; removeBackgroundNoise: boolean }[] = [];
  readonly takes: { key: string; ownerId: string; bytes: number; agreementId: string; language: string; transcript: string }[] = [];

  private entry(ownerId: string) {
    return [...this.voices.values()].find((v) => v.ownerId === ownerId && v.status !== "deleted") ?? null;
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
      bytes: take.audio.size,
      agreementId: take.agreement.id,
      language: DEMO_SCRIPT.locale,
      transcript: expectedTranscript(take.scriptOffsetEnd),
    });
    const id = randomUUID();
    this.receipts.push({ id, ownerId: owner.id, agreementId: take.agreement.id, removeBackgroundNoise: take.removeBackgroundNoise });
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
}

const BUCKET = "voice-recordings";
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
      this.db.from("voice_script_versions").select("id, voice_scripts!inner(slug)").eq("voice_scripts.slug", "guest_short.en").eq("version", DEMO_SCRIPT.version).single(),
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
      this.db.from("voice_profiles").select("provider_voice_id_encrypted").eq("id", voiceId).neq("status", "deleted").maybeSingle(),
      "read provider voice",
    );
    const enc = row?.provider_voice_id_encrypted as string | null | undefined;
    return enc ? this.cipher.decrypt(enc) : null;
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

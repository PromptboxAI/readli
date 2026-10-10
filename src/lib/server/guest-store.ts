import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";
import type { ServerConfig } from "./config";
import { GUEST_TTL_MS } from "./guest-token";
import { baseMimeType } from "./recording-qc";

export interface GuestSession {
  id: string;
  expiresAt: string;
  generationsUsed: number;
  generationsAllowed: number;
  hasVoice: boolean;
}

export interface RecordingMeta {
  durationMs: number;
  mimeType: string;
  teleprompterWpm: number | null;
  pauseCount: number;
  deviceClass: "phone" | "tablet" | "desktop" | null;
  scriptOffsetEnd: number | null;
}

export interface ExpiredGuest {
  sessionId: string;
  providerVoiceIds: string[];
  storageKeys: string[];
}

/** Everything the guest demo persists. Supabase in live mode, memory in stub mode. */
export interface GuestStore {
  createSession(input: { tokenHash: string; policyVersion: string }): Promise<GuestSession>;
  findSession(tokenHash: string): Promise<GuestSession | null>;
  saveRecording(sessionId: string, audio: Blob, meta: RecordingMeta): Promise<{ recordingId: string }>;
  latestRecording(sessionId: string): Promise<{ audio: Blob; mimeType: string } | null>;
  setVoice(sessionId: string, providerVoiceId: string): Promise<void>;
  getVoice(sessionId: string): Promise<string | null>;
  /** How many provider voices this guest has made (retakes each make one). */
  voiceCount(sessionId: string): Promise<number>;
  /** Atomically spends one preview; false when the guest has none left. */
  useGeneration(sessionId: string): Promise<boolean>;
  refundGeneration(sessionId: string): Promise<void>;
  /** Database kill switch (feature_flags.demo_audio). */
  demoAudioEnabled(): Promise<boolean>;
  listExpired(limit: number): Promise<ExpiredGuest[]>;
  deleteStorage(keys: string[]): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

const GENERATIONS_ALLOWED = 2;

function extensionFor(mimeType: string): string {
  return { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav" }[baseMimeType(mimeType)] ?? "bin";
}

// ---------------------------------------------------------------------------
// Memory store (stub mode only). Survives hot reloads via globalThis.
// ---------------------------------------------------------------------------
interface MemoryGuest {
  session: GuestSession;
  tokenHash: string;
  recordings: { key: string; audio: Blob; mimeType: string }[];
  voiceId: string | null;
}

export class MemoryGuestStore implements GuestStore {
  readonly guests = new Map<string, MemoryGuest>();

  async createSession({ tokenHash }: { tokenHash: string; policyVersion: string }) {
    const session: GuestSession = {
      id: randomUUID(),
      expiresAt: new Date(Date.now() + GUEST_TTL_MS).toISOString(),
      generationsUsed: 0,
      generationsAllowed: GENERATIONS_ALLOWED,
      hasVoice: false,
    };
    this.guests.set(session.id, { session, tokenHash, recordings: [], voiceId: null });
    return { ...session };
  }

  async findSession(tokenHash: string) {
    for (const g of this.guests.values()) {
      if (g.tokenHash === tokenHash && Date.parse(g.session.expiresAt) > Date.now()) return { ...g.session, hasVoice: g.voiceId !== null };
    }
    return null;
  }

  private guest(id: string): MemoryGuest {
    const g = this.guests.get(id);
    if (!g) throw new Error("guest session not found");
    return g;
  }

  async saveRecording(sessionId: string, audio: Blob, meta: RecordingMeta) {
    const key = `${sessionId}/${randomUUID()}.${extensionFor(meta.mimeType)}`;
    this.guest(sessionId).recordings.push({ key, audio, mimeType: baseMimeType(meta.mimeType) });
    return { recordingId: key };
  }

  async latestRecording(sessionId: string) {
    const r = this.guest(sessionId).recordings.at(-1);
    return r ? { audio: r.audio, mimeType: r.mimeType } : null;
  }

  async setVoice(sessionId: string, voiceId: string) {
    this.guest(sessionId).voiceId = voiceId;
    this.voicesMade.set(sessionId, (this.voicesMade.get(sessionId) ?? 0) + 1);
  }

  async getVoice(sessionId: string) {
    return this.guest(sessionId).voiceId;
  }

  readonly voicesMade = new Map<string, number>();

  async voiceCount(sessionId: string) {
    return this.voicesMade.get(sessionId) ?? 0;
  }

  async useGeneration(sessionId: string) {
    const s = this.guest(sessionId).session;
    if (s.generationsUsed >= s.generationsAllowed) return false;
    s.generationsUsed += 1;
    return true;
  }

  async refundGeneration(sessionId: string) {
    const s = this.guest(sessionId).session;
    s.generationsUsed = Math.max(0, s.generationsUsed - 1);
  }

  async demoAudioEnabled() {
    return true;
  }

  async listExpired(limit: number) {
    return [...this.guests.values()]
      .filter((g) => Date.parse(g.session.expiresAt) <= Date.now())
      .slice(0, limit)
      .map((g) => ({ sessionId: g.session.id, providerVoiceIds: g.voiceId ? [g.voiceId] : [], storageKeys: g.recordings.map((r) => r.key) }));
  }

  async deleteStorage() {}

  async deleteSession(sessionId: string) {
    this.guests.delete(sessionId);
  }
}

// ---------------------------------------------------------------------------
// Supabase store (live mode). Service role only; RLS keeps these tables closed to browsers.
// ---------------------------------------------------------------------------
const BUCKET = "guest-recordings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export class SupabaseGuestStore implements GuestStore {
  private scriptVersionId: string | null = null;
  private readonly key: Buffer;

  constructor(
    private readonly db: SupabaseClient,
    secret: string,
  ) {
    // Provider voice ids are stored encrypted (guest_assets.provider_ref_encrypted).
    this.key = createHash("sha256").update(`readli-provider-ref:${secret}`).digest();
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return `\\x${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("hex")}`;
  }

  private decrypt(stored: string): string {
    const raw = Buffer.from(stored.replace(/^\\x/, ""), "hex");
    const decipher = createDecipheriv("aes-256-gcm", this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  }

  /** Runs a query that must return data. Rows are untyped until we generate Supabase types. */
  private async must<T = Row>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(`${what}: ${error.message}`);
    if (data === null || data === undefined) throw new Error(`${what}: no data`);
    return data as T;
  }

  /** Runs a query whose result may be empty (maybeSingle) or absent (writes without select). */
  private async maybe<T = Row>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T | null> {
    const { data, error } = await p;
    if (error) throw new Error(`${what}: ${error.message}`);
    return (data ?? null) as T | null;
  }

  private toSession(row: Row, hasVoice: boolean): GuestSession {
    return { id: row.id, expiresAt: row.expires_at, generationsUsed: row.generations_used, generationsAllowed: row.generations_allowed, hasVoice };
  }

  async createSession({ tokenHash, policyVersion }: { tokenHash: string; policyVersion: string }) {
    const row = await this.must(
      this.db
        .from("guest_sessions")
        .insert({ signed_id_hash: tokenHash, generations_allowed: GENERATIONS_ALLOWED, expires_at: new Date(Date.now() + GUEST_TTL_MS).toISOString() })
        .select("id, expires_at, generations_used, generations_allowed")
        .single(),
      "create guest session",
    );
    const receipt = await this.must(
      this.db
        .from("consent_receipts")
        .insert({
          guest_session_id: row.id,
          policy_version: policyVersion,
          purpose: "guest_demo_processing",
          adult_owner_declared: true,
          accepted_fields: { adult_owner: true, processing: true },
        })
        .select("id")
        .single(),
      "create consent receipt",
    );
    await this.maybe(this.db.from("guest_sessions").update({ consent_receipt_id: receipt.id }).eq("id", row.id), "link consent receipt");
    return this.toSession(row, false);
  }

  async findSession(tokenHash: string) {
    const row = await this.maybe(
      this.db
        .from("guest_sessions")
        .select("id, expires_at, generations_used, generations_allowed")
        .eq("signed_id_hash", tokenHash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle(),
      "find guest session",
    );
    if (!row) return null;
    return this.toSession(row, (await this.getVoice(row.id)) !== null);
  }

  private async guestScriptVersionId(): Promise<string> {
    if (this.scriptVersionId) return this.scriptVersionId;
    const row = await this.must(
      this.db.from("voice_script_versions").select("id, voice_scripts!inner(slug)").eq("voice_scripts.slug", "guest_short.en").eq("version", DEMO_SCRIPT.version).single(),
      "find guest script version",
    );
    this.scriptVersionId = row.id as string;
    return this.scriptVersionId;
  }

  async saveRecording(sessionId: string, audio: Blob, meta: RecordingMeta) {
    const mimeType = baseMimeType(meta.mimeType);
    const key = `${sessionId}/${randomUUID()}.${extensionFor(mimeType)}`;
    const { error } = await this.db.storage.from(BUCKET).upload(key, audio, { contentType: mimeType, upsert: false });
    if (error) throw new Error(`upload recording: ${error.message}`);

    const session = await this.must(this.db.from("guest_sessions").select("expires_at, consent_receipt_id").eq("id", sessionId).single(), "read guest session");
    await this.maybe(
      this.db.from("guest_assets").insert({ guest_session_id: sessionId, kind: "recording", storage_key: key, expires_at: session.expires_at }),
      "record guest asset",
    );
    await this.maybe(
      this.db.from("voice_training_sessions").insert({
        guest_session_id: sessionId,
        recording_mode: "guest_short",
        script_version_id: await this.guestScriptVersionId(),
        script_offset_end: meta.scriptOffsetEnd,
        teleprompter_speed: meta.teleprompterWpm,
        recorded_duration_ms: Math.round(meta.durationMs),
        usable_duration_ms: Math.round(meta.durationMs),
        pause_events_count: meta.pauseCount,
        device_class: meta.deviceClass,
        audio_qc_status: "passed",
        recording_status: "accepted",
        consent_receipt_id: session.consent_receipt_id,
      }),
      "record training session",
    );
    return { recordingId: key };
  }

  async latestRecording(sessionId: string) {
    const row = await this.maybe(
      this.db
        .from("guest_assets")
        .select("storage_key")
        .eq("guest_session_id", sessionId)
        .eq("kind", "recording")
        .eq("deletion_state", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "find latest recording",
    );
    if (!row?.storage_key) return null;
    const { data, error } = await this.db.storage.from(BUCKET).download(row.storage_key);
    if (error || !data) throw new Error(`download recording: ${error?.message ?? "empty"}`);
    return { audio: data, mimeType: data.type || "audio/webm" };
  }

  async setVoice(sessionId: string, voiceId: string) {
    const session = await this.must(this.db.from("guest_sessions").select("expires_at").eq("id", sessionId).single(), "read guest session");
    await this.maybe(
      this.db.from("guest_assets").insert({
        guest_session_id: sessionId,
        kind: "provider_voice",
        provider_ref_encrypted: this.encrypt(voiceId),
        expires_at: session.expires_at,
      }),
      "record provider voice",
    );
  }

  async getVoice(sessionId: string) {
    const row = await this.maybe(
      this.db
        .from("guest_assets")
        .select("provider_ref_encrypted")
        .eq("guest_session_id", sessionId)
        .eq("kind", "provider_voice")
        .eq("deletion_state", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "find provider voice",
    );
    return row?.provider_ref_encrypted ? this.decrypt(row.provider_ref_encrypted as string) : null;
  }

  async voiceCount(sessionId: string) {
    const { count, error } = await this.db
      .from("guest_assets")
      .select("id", { count: "exact", head: true })
      .eq("guest_session_id", sessionId)
      .eq("kind", "provider_voice");
    if (error) throw new Error(`count provider voices: ${error.message}`);
    return count ?? 0;
  }

  async useGeneration(sessionId: string) {
    return Boolean(await this.maybe(this.db.rpc("use_guest_generation", { p_session: sessionId }), "spend preview"));
  }

  async refundGeneration(sessionId: string) {
    await this.maybe(this.db.rpc("refund_guest_generation", { p_session: sessionId }), "refund preview");
  }

  async demoAudioEnabled() {
    const row = await this.maybe(this.db.from("feature_flags").select("enabled").eq("key", "demo_audio").maybeSingle(), "read demo_audio flag");
    return row?.enabled === true;
  }

  async listExpired(limit: number) {
    const sessions = await this.must<Row[]>(
      this.db.from("guest_sessions").select("id").lte("expires_at", new Date().toISOString()).limit(limit),
      "list expired guests",
    );
    const out: ExpiredGuest[] = [];
    for (const { id } of sessions) {
      const assets = await this.must<Row[]>(
        this.db.from("guest_assets").select("kind, storage_key, provider_ref_encrypted").eq("guest_session_id", id).neq("deletion_state", "deleted"),
        "list guest assets",
      );
      out.push({
        sessionId: id,
        providerVoiceIds: assets.filter((a) => a.kind === "provider_voice" && a.provider_ref_encrypted).map((a) => this.decrypt(a.provider_ref_encrypted as string)),
        storageKeys: assets.filter((a) => a.kind === "recording" && a.storage_key).map((a) => a.storage_key as string),
      });
    }
    return out;
  }

  async deleteStorage(keys: string[]) {
    if (keys.length === 0) return;
    const { error } = await this.db.storage.from(BUCKET).remove(keys);
    if (error) throw new Error(`delete recordings: ${error.message}`);
  }

  async deleteSession(sessionId: string) {
    // Cascades to guest_assets, consent receipts and training sessions.
    await this.maybe(this.db.from("guest_sessions").delete().eq("id", sessionId), "delete guest session");
  }
}

export function createSupabaseGuestStore(config: ServerConfig): SupabaseGuestStore {
  if (!config.supabaseUrl || !config.supabaseServiceKey || !config.cookieSecret) throw new Error("Supabase is not configured");
  const db = createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return new SupabaseGuestStore(db, config.cookieSecret);
}

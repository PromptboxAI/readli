import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_SCRIPT } from "@/lib/content/voice-scripts";
import type { ServerConfig } from "./config";
import { GUEST_TTL_MS } from "./guest-token";
import { ProviderRefCipher } from "./provider-ref";
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
  createSession(input: { tokenHash: string; policyVersion: string; generationsAllowed: number }): Promise<GuestSession>;
  findSession(tokenHash: string): Promise<GuestSession | null>;
  saveRecording(sessionId: string, audio: Blob, meta: RecordingMeta): Promise<{ recordingId: string }>;
  /** The guest's latest take, with its length when it was recorded (null if unknown). */
  latestRecording(sessionId: string): Promise<{ audio: Blob; mimeType: string; durationMs: number | null } | null>;
  setVoice(sessionId: string, providerVoiceId: string): Promise<void>;
  getVoice(sessionId: string): Promise<string | null>;
  /** How many provider voices this guest has made (retakes each make one). */
  voiceCount(sessionId: string): Promise<number>;
  /** Atomically spends one preview; false when the guest has none left. */
  useGeneration(sessionId: string): Promise<boolean>;
  refundGeneration(sessionId: string): Promise<void>;
  /** A story already read in this voice, kept so replays are free. `key` names the voice and the book. */
  findPreview(sessionId: string, key: string): Promise<{ audio: Blob; contentType: string } | null>;
  savePreview(sessionId: string, key: string, audio: ArrayBuffer, contentType: string): Promise<void>;
  /** Database kill switch (feature_flags.demo_audio). */
  demoAudioEnabled(): Promise<boolean>;
  /** Guests whose session had expired at `asOfIso` (default now), with everything left to delete. */
  /** `onlySessionId` limits it to one session, for the staging deletion check. */
  listExpired(limit: number, asOfIso?: string, onlySessionId?: string): Promise<ExpiredGuest[]>;
  /** Guests whose session expired before this time and still aren't deleted. */
  overdueCount(expiredBeforeIso: string, onlySessionId?: string): Promise<number>;
  /**
   * Records how far a guest's deletion got: provider voices marked deleted are not deleted again, and
   * failed ones show which step to retry. The encrypted reference stays until the session row goes.
   */
  markDeletion(sessionId: string, kind: "provider_voice", state: "deleted" | "failed"): Promise<void>;
  deleteStorage(keys: string[]): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

/** Where a cached preview lives in the guest bucket. Keys come from the server, never the browser. */
export function previewStorageKey(sessionId: string, key: string): string {
  return `${sessionId}/previews/${key.replace(/[^a-zA-Z0-9_-]/g, "")}.mp3`;
}

function extensionFor(mimeType: string): string {
  return { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav" }[baseMimeType(mimeType)] ?? "bin";
}

// ---------------------------------------------------------------------------
// Memory store (stub mode only). Survives hot reloads via globalThis.
// ---------------------------------------------------------------------------
interface MemoryGuest {
  session: GuestSession;
  tokenHash: string;
  recordings: { key: string; audio: Blob; mimeType: string; durationMs: number }[];
  previews: Map<string, { audio: Blob; contentType: string }>;
  voiceId: string | null;
}

export class MemoryGuestStore implements GuestStore {
  readonly guests = new Map<string, MemoryGuest>();

  async createSession({ tokenHash, generationsAllowed }: { tokenHash: string; policyVersion: string; generationsAllowed: number }) {
    const session: GuestSession = {
      id: randomUUID(),
      expiresAt: new Date(Date.now() + GUEST_TTL_MS).toISOString(),
      generationsUsed: 0,
      generationsAllowed,
      hasVoice: false,
    };
    this.guests.set(session.id, { session, tokenHash, recordings: [], previews: new Map(), voiceId: null });
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
    this.guest(sessionId).recordings.push({ key, audio, mimeType: baseMimeType(meta.mimeType), durationMs: meta.durationMs });
    return { recordingId: key };
  }

  async latestRecording(sessionId: string) {
    const r = this.guest(sessionId).recordings.at(-1);
    return r ? { audio: r.audio, mimeType: r.mimeType, durationMs: r.durationMs } : null;
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

  async findPreview(sessionId: string, key: string) {
    return this.guest(sessionId).previews.get(key) ?? null;
  }

  async savePreview(sessionId: string, key: string, audio: ArrayBuffer, contentType: string) {
    this.guest(sessionId).previews.set(key, { audio: new Blob([audio], { type: contentType }), contentType });
  }

  async demoAudioEnabled() {
    return true;
  }

  async listExpired(limit: number, asOfIso = new Date().toISOString(), onlySessionId?: string) {
    return [...this.guests.values()]
      .filter((g) => Date.parse(g.session.expiresAt) <= Date.parse(asOfIso) && (!onlySessionId || g.session.id === onlySessionId))
      .slice(0, limit)
      .map((g) => ({
        sessionId: g.session.id,
        providerVoiceIds: g.voiceId ? [g.voiceId] : [],
        storageKeys: [...g.recordings.map((r) => r.key), ...[...g.previews.keys()].map((k) => previewStorageKey(g.session.id, k))],
      }));
  }

  async overdueCount(expiredBeforeIso: string, onlySessionId?: string) {
    return [...this.guests.values()].filter((g) => g.session.expiresAt < expiredBeforeIso && (!onlySessionId || g.session.id === onlySessionId)).length;
  }

  async markDeletion(sessionId: string, _kind: "provider_voice", state: "deleted" | "failed") {
    const g = this.guests.get(sessionId);
    if (g && state === "deleted") g.voiceId = null;
  }

  async deleteStorage(_keys: string[]) {}

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
  private readonly cipher: ProviderRefCipher;

  constructor(
    private readonly db: SupabaseClient,
    secret: string,
  ) {
    // Provider voice ids are stored encrypted (guest_assets.provider_ref_encrypted).
    this.cipher = new ProviderRefCipher(secret);
  }

  private encrypt(plain: string): string {
    return this.cipher.encrypt(plain);
  }

  private decrypt(stored: string): string {
    return this.cipher.decrypt(stored);
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

  async createSession({ tokenHash, policyVersion, generationsAllowed }: { tokenHash: string; policyVersion: string; generationsAllowed: number }) {
    const row = await this.must(
      this.db
        .from("guest_sessions")
        .insert({ signed_id_hash: tokenHash, generations_allowed: generationsAllowed, expires_at: new Date(Date.now() + GUEST_TTL_MS).toISOString() })
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
      this.db.from("voice_script_versions").select("id, voice_scripts!inner(slug)").eq("voice_scripts.slug", "guest_short.en").lte("version", DEMO_SCRIPT.version).order("version", { ascending: false }).limit(1).single(),
      "find guest script version",
    );
    this.scriptVersionId = row.id as string;
    return this.scriptVersionId;
  }

  async saveRecording(sessionId: string, audio: Blob, meta: RecordingMeta) {
    const mimeType = baseMimeType(meta.mimeType);
    const key = `${sessionId}/${randomUUID()}.${extensionFor(mimeType)}`;
    // A Blob is sent as a multipart part typed by the Blob itself, so retype it to the bare MIME type the bucket allows.
    const body = new Blob([audio], { type: mimeType });
    const { error } = await this.db.storage.from(BUCKET).upload(key, body, { contentType: mimeType, upsert: false });
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
    const take = await this.maybe(
      this.db
        .from("voice_training_sessions")
        .select("recorded_duration_ms")
        .eq("guest_session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "find latest take",
    );
    const durationMs = typeof take?.recorded_duration_ms === "number" ? take.recorded_duration_ms : null;
    return { audio: data, mimeType: data.type || "audio/webm", durationMs };
  }

  async setVoice(sessionId: string, voiceId: string) {
    const session = await this.must(this.db.from("guest_sessions").select("expires_at").eq("id", sessionId).single(), "read guest session");
    // Must be recorded, or the cleanup job would never find this provider voice to delete it.
    const { error } = await this.db.from("guest_assets").insert({
      guest_session_id: sessionId,
      kind: "provider_voice",
      provider_ref_encrypted: this.encrypt(voiceId),
      expires_at: session.expires_at,
    });
    if (error) throw new Error(`record provider voice: ${error.message}`);
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

  async findPreview(sessionId: string, key: string) {
    const storageKey = previewStorageKey(sessionId, key);
    const row = await this.maybe(
      this.db
        .from("guest_assets")
        .select("id")
        .eq("guest_session_id", sessionId)
        .eq("kind", "generated_audio")
        .eq("storage_key", storageKey)
        .eq("deletion_state", "active")
        .limit(1)
        .maybeSingle(),
      "find cached preview",
    );
    if (!row) return null;
    const { data, error } = await this.db.storage.from(BUCKET).download(storageKey);
    if (error || !data) return null; // A missing file just means the story is read again.
    return { audio: data, contentType: data.type || "audio/mpeg" };
  }

  async savePreview(sessionId: string, key: string, audio: ArrayBuffer, contentType: string) {
    const storageKey = previewStorageKey(sessionId, key);
    const type = baseMimeType(contentType);
    const { error } = await this.db.storage.from(BUCKET).upload(storageKey, new Blob([audio], { type }), { contentType: type, upsert: true });
    if (error) throw new Error(`save preview: ${error.message}`);
    const session = await this.must(this.db.from("guest_sessions").select("expires_at").eq("id", sessionId).single(), "read guest session");
    await this.maybe(
      this.db.from("guest_assets").insert({ guest_session_id: sessionId, kind: "generated_audio", storage_key: storageKey, expires_at: session.expires_at }),
      "record cached preview",
    );
  }

  async demoAudioEnabled() {
    const row = await this.maybe(this.db.from("feature_flags").select("enabled").eq("key", "demo_audio").maybeSingle(), "read demo_audio flag");
    return row?.enabled === true;
  }

  async listExpired(limit: number, asOfIso = new Date().toISOString(), onlySessionId?: string) {
    let query = this.db.from("guest_sessions").select("id").lte("expires_at", asOfIso);
    if (onlySessionId) query = query.eq("id", onlySessionId);
    const sessions = await this.must<Row[]>(
      query.order("expires_at").limit(limit),
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
        // Everything under the guest's folders goes too, even a file whose asset row was never written.
        storageKeys: [
          ...new Set([
            ...assets.filter((a) => (a.kind === "recording" || a.kind === "generated_audio") && a.storage_key).map((a) => a.storage_key as string),
            ...(await this.folderFiles(id)),
            ...(await this.folderFiles(`${id}/previews`)),
          ]),
        ],
      });
    }
    return out;
  }

  /** Files directly inside one folder of the guest bucket. */
  private async folderFiles(folder: string): Promise<string[]> {
    const keys: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await this.db.storage.from(BUCKET).list(folder, { limit: 1000, offset });
      if (error) throw new Error(`list guest files: ${error.message}`);
      keys.push(...(data ?? []).filter((f) => f.id !== null).map((f) => `${folder}/${f.name}`));
      if (!data || data.length < 1000) return keys;
    }
  }

  async overdueCount(expiredBeforeIso: string, onlySessionId?: string) {
    let query = this.db.from("guest_sessions").select("id", { count: "exact", head: true }).lt("expires_at", expiredBeforeIso);
    if (onlySessionId) query = query.eq("id", onlySessionId);
    const { count, error } = await query;
    if (error) throw new Error(`count overdue guests: ${error.message}`);
    return count ?? 0;
  }

  async markDeletion(sessionId: string, kind: "provider_voice", state: "deleted" | "failed") {
    await this.maybe(
      this.db.from("guest_assets").update({ deletion_state: state, updated_at: new Date().toISOString() }).eq("guest_session_id", sessionId).eq("kind", kind).neq("deletion_state", "deleted"),
      "record guest deletion step",
    );
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

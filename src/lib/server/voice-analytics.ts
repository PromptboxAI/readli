import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ServerConfig } from "./config";

/**
 * Voice-quality events for the admin dashboard (analytics_events). Adult-only and first-party:
 * never audio, transcripts or child identifiers. A failed write never breaks recording.
 */
export const VOICE_EVENTS = [
  // Server-side
  "recording_submitted",
  "voice_cloned",
  "voice_kept",
  "voice_discarded",
  "preview_generated",
  "preview_replayed",
  // From the browser
  "recording_restarted",
  "quality_warning_shown",
  "recording_used_with_warnings",
  "tips_opened",
  "doesnt_sound_like_me",
] as const;

export type VoiceEventName = (typeof VOICE_EVENTS)[number];

/** Events the browser may send. Everything else is written only by the server. */
export const CLIENT_VOICE_EVENTS: readonly VoiceEventName[] = [
  "recording_restarted",
  "quality_warning_shown",
  "recording_used_with_warnings",
  "tips_opened",
  "doesnt_sound_like_me",
];

export type EventProperties = Record<string, string | number | boolean | null | string[]>;

export interface VoiceEvent {
  name: VoiceEventName;
  userId?: string | null;
  guestSessionId?: string | null;
  properties?: EventProperties;
  occurredAt?: string;
}

export interface VoiceEventSink {
  record(event: VoiceEvent): Promise<void>;
  /** Events since a time, newest first, for the dashboard. */
  since(fromIso: string): Promise<Required<Pick<VoiceEvent, "name" | "properties" | "occurredAt">>[]>;
}

/** Keeps only short, flat values: a client can't use events to store anything else. */
export function cleanProperties(input: unknown): EventProperties {
  const out: EventProperties = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, value] of Object.entries(input).slice(0, 12)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean" || value === null) out[key] = value;
    else if (typeof value === "string") out[key] = value.slice(0, 80);
    else if (Array.isArray(value)) out[key] = value.filter((v): v is string => typeof v === "string").slice(0, 8).map((v) => v.slice(0, 40));
  }
  return out;
}

export class MemoryVoiceEventSink implements VoiceEventSink {
  readonly events: Required<Pick<VoiceEvent, "name" | "properties" | "occurredAt">>[] = [];

  async record(event: VoiceEvent) {
    this.events.unshift({ name: event.name, properties: event.properties ?? {}, occurredAt: event.occurredAt ?? new Date().toISOString() });
  }

  async since(fromIso: string) {
    return this.events.filter((e) => e.occurredAt >= fromIso);
  }
}

export class SupabaseVoiceEventSink implements VoiceEventSink {
  constructor(private readonly db: SupabaseClient) {}

  async record(event: VoiceEvent) {
    const { error } = await this.db.from("analytics_events").insert({
      name: event.name,
      user_id: event.userId ?? null,
      guest_session_id: event.guestSessionId ?? null,
      properties: event.properties ?? {},
    });
    if (error) console.error("voice event not recorded", event.name, error.message);
  }

  async since(fromIso: string) {
    const { data, error } = await this.db
      .from("analytics_events")
      .select("name, properties, occurred_at")
      .in("name", VOICE_EVENTS as unknown as string[])
      .gte("occurred_at", fromIso)
      .order("occurred_at", { ascending: false })
      .limit(20_000);
    if (error) throw new Error(`read voice events: ${error.message}`);
    return (data ?? []).map((r) => ({ name: r.name as VoiceEventName, properties: (r.properties ?? {}) as EventProperties, occurredAt: r.occurred_at as string }));
  }
}

const g = globalThis as typeof globalThis & { __readliVoiceEvents?: MemoryVoiceEventSink };

/** Where voice events go in this mode; null when there's nowhere to keep them. */
export function voiceEventSink(config: ServerConfig): VoiceEventSink | null {
  if (config.mode === "stub") return (g.__readliVoiceEvents ??= new MemoryVoiceEventSink());
  if (config.supabaseUrl && config.supabaseServiceKey) {
    return new SupabaseVoiceEventSink(createClient(config.supabaseUrl, config.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } }));
  }
  return null;
}

/** Records an event without ever failing the request it belongs to. */
export async function recordVoiceEvent(config: ServerConfig, event: VoiceEvent): Promise<void> {
  try {
    await voiceEventSink(config)?.record(event);
  } catch (err) {
    console.error("voice event failed", event.name, err);
  }
}

export interface VoiceQualityMetrics {
  days: number;
  recordings: { guest: number; account: number };
  restarts: number;
  warnings: Record<string, number>;
  usedWithWarnings: number;
  clones: { guest: number; account: number };
  accountKept: number;
  accountDiscarded: number;
  /** Kept ÷ (kept + discarded) for account voices, or null before any decision. */
  acceptanceRate: number | null;
  doesntSoundLikeMe: number;
  tipsOpened: number;
  /** Recordings made after the reader asked how to improve. */
  rerecordsAfterFeedback: number;
  previews: { generated: number; replayed: number; characters: number; usd: number };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function summarizeVoiceEvents(events: { name: string; properties: EventProperties }[], days: number): VoiceQualityMetrics {
  const m: VoiceQualityMetrics = {
    days,
    recordings: { guest: 0, account: 0 },
    restarts: 0,
    warnings: {},
    usedWithWarnings: 0,
    clones: { guest: 0, account: 0 },
    accountKept: 0,
    accountDiscarded: 0,
    acceptanceRate: null,
    doesntSoundLikeMe: 0,
    tipsOpened: 0,
    rerecordsAfterFeedback: 0,
    previews: { generated: 0, replayed: 0, characters: 0, usd: 0 },
  };
  for (const e of events) {
    const p = e.properties;
    const surface = p.surface === "account" ? "account" : "guest";
    switch (e.name) {
      case "recording_submitted":
        m.recordings[surface] += 1;
        if (p.afterFeedback === true) m.rerecordsAfterFeedback += 1;
        break;
      case "recording_restarted":
        m.restarts += 1;
        break;
      case "quality_warning_shown":
        for (const issue of Array.isArray(p.issues) ? p.issues : []) m.warnings[issue] = (m.warnings[issue] ?? 0) + 1;
        break;
      case "recording_used_with_warnings":
        m.usedWithWarnings += 1;
        break;
      case "voice_cloned":
        m.clones[surface] += 1;
        break;
      case "voice_kept":
        m.accountKept += 1;
        break;
      case "voice_discarded":
        m.accountDiscarded += 1;
        break;
      case "doesnt_sound_like_me":
        m.doesntSoundLikeMe += 1;
        break;
      case "tips_opened":
        m.tipsOpened += 1;
        break;
      case "preview_generated":
        m.previews.generated += 1;
        m.previews.characters += num(p.characters);
        m.previews.usd += num(p.usd);
        break;
      case "preview_replayed":
        m.previews.replayed += 1;
        break;
    }
  }
  const decided = m.accountKept + m.accountDiscarded;
  m.acceptanceRate = decided ? m.accountKept / decided : null;
  return m;
}

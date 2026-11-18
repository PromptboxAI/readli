import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A free Readli Voice account's getting-started list on its Home: record, hear another story, send one to a
 * family, give Readli as a gift. What can be seen elsewhere (the voice, invitations, gifts) is read from there;
 * only the welcome, the first story heard on Home and hiding the list are kept in voice_home_progress.
 */
export interface VoiceHomeProgress {
  welcomedAt: string | null;
  storyHeardAt: string | null;
  hiddenAt: string | null;
}

export const NO_PROGRESS: VoiceHomeProgress = { welcomedAt: null, storyHeardAt: null, hiddenAt: null };

export type VoiceHomeStepId = "record" | "hear" | "send" | "gift";

export interface VoiceHomeStep {
  id: VoiceHomeStepId;
  title: string;
  hint: string;
  done: boolean;
  /** Where the step's button goes; none once it's done. */
  action: { href: string; label: string } | null;
}

export interface VoiceHomeFacts {
  /** A voice recorded and kept, ready or still being made. */
  recorded: boolean;
  heard: boolean;
  /** Any family invited, or already hearing their voice. */
  sent: boolean;
  gave: boolean;
  /** Whether gifts are on sale here; without it the gift step is left out. */
  gifting: boolean;
}

export function voiceHomeSteps(f: VoiceHomeFacts): VoiceHomeStep[] {
  const steps: VoiceHomeStep[] = [
    { id: "record", title: "Record your voice", hint: f.recorded ? "Done when you signed up" : "About a minute of reading aloud", done: f.recorded, action: { href: "/voice/record", label: "Record" } },
    { id: "hear", title: "Hear another story in your voice", hint: "Pick any book on your shelf below", done: f.heard, action: { href: "#stories", label: "Pick a story" } },
    { id: "send", title: "Send a story to your family", hint: "They hear it free, then say yes to your voice", done: f.sent, action: { href: "/voice/invite", label: "Send a story" } },
    { id: "gift", title: "Give Readli as a gift", hint: "Cover Readli Family for up to two families", done: f.gave, action: { href: "/gift/family", label: "See the gift" } },
  ];
  return steps.filter((s) => s.id !== "gift" || f.gifting || f.gave).map((s) => (s.done ? { ...s, action: null } : s));
}

/** The list shows until every step is done or they hide it. */
export function showVoiceHomeSteps(steps: VoiceHomeStep[], progress: VoiceHomeProgress): boolean {
  return !progress.hiddenAt && steps.some((s) => !s.done);
}

const TABLE = "voice_home_progress";

export async function readVoiceHomeProgress(db: SupabaseClient | null, userId: string): Promise<VoiceHomeProgress> {
  if (!db) return NO_PROGRESS;
  const { data, error } = await db.from(TABLE).select("welcomed_at, story_heard_at, hidden_at").eq("user_id", userId).maybeSingle();
  if (error || !data) return NO_PROGRESS;
  const row = data as { welcomed_at: string | null; story_heard_at: string | null; hidden_at: string | null };
  return { welcomedAt: row.welcomed_at, storyHeardAt: row.story_heard_at, hiddenAt: row.hidden_at };
}

/** Voice Home opened: from now on, stories they hear count toward the list. */
export async function openVoiceHome(db: SupabaseClient | null, userId: string): Promise<void> {
  if (!db) return;
  try {
    await db.from(TABLE).upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  } catch {
    // Best effort.
  }
}

const COLUMN = { welcomed: "welcomed_at", hidden: "hidden_at" } as const;

/** Keeps the first time they saw the welcome or hid the list. Never throws: progress is a nicety. */
export async function markVoiceHome(db: SupabaseClient | null, userId: string, what: keyof typeof COLUMN): Promise<void> {
  if (!db) return;
  const column = COLUMN[what];
  try {
    await db.from(TABLE).upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    await db.from(TABLE).update({ [column]: new Date().toISOString() }).eq("user_id", userId).is(column, null);
  } catch {
    // Best effort.
  }
}

/**
 * A story heard in their voice counts once they've opened Voice Home or its welcome, so the
 * story heard during signup doesn't tick "hear another story" for them.
 */
export async function markStoryHeard(db: SupabaseClient | null, userId: string): Promise<void> {
  if (!db) return;
  try {
    await db.from(TABLE).update({ story_heard_at: new Date().toISOString() }).eq("user_id", userId).is("story_heard_at", null);
  } catch {
    // Best effort.
  }
}

/** Whether they've paid for a gift of Readli Family (a sponsorship past checkout). */
export async function hasGivenGift(db: SupabaseClient | null, userId: string): Promise<boolean> {
  if (!db) return false;
  const { data, error } = await db.from("sponsorships").select("id").eq("sponsor_id", userId).neq("status", "awaiting_payment").limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

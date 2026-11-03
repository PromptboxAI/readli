import type { FamilyState } from "./model";
import { activeShare } from "./permissions";

/**
 * The three getting-started steps on /family/setup: a voice to read with, the kids added, and a first
 * story chosen. Family Home shows how many are done, with a way back, until all three are.
 */
export interface SetupProgress {
  voice: boolean;
  kids: boolean;
  story: boolean;
  done: number;
  /** The first step still to do, or null once all three are done. */
  next: "voice" | "kids" | "story" | null;
}

/** A voice this grown-up recorded (even one still being made), or a ready storyteller's voice shared with the family. */
export function hasReadingVoice(state: FamilyState, adultId: string, home: string): boolean {
  return state.voices.some(
    (v) => v.deletedAt === null && (v.ownerId === adultId || (v.status === "ready" && activeShare(state, v.id, home) !== null)),
  );
}

/** Whether the family has asked for any narration yet (being prepared or prepared). */
export function firstStoryChosen(state: FamilyState, home: string): boolean {
  return state.jobs.some((j) => j.householdId === home && j.status !== "failed" && j.status !== "canceled");
}

export function setupProgress({ voice, kids, story }: { voice: boolean; kids: boolean; story: boolean }): SetupProgress {
  const next = !voice ? "voice" : !kids ? "kids" : !story ? "story" : null;
  return { voice, kids, story, done: [voice, kids, story].filter(Boolean).length, next };
}

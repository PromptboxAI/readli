import type { FamilyState } from "./model";
import type { PlanConfig } from "./plan";
import { activeApproval, activeShare, activeSlot } from "./permissions";

/**
 * Getting-started progress on /family/setup's five steps. Three are needed (a voice to read with, the kids
 * added, a first story chosen); inviting family is optional and listening follows the story. Family Home
 * counts all five, and shows the count with a way back until the three needed ones are done.
 */
export interface SetupProgress {
  voice: boolean;
  kids: boolean;
  story: boolean;
  /** Steps done, out of SETUP_TOTAL. */
  done: number;
  /** The first needed step still to do, or null once all three are done. */
  next: "voice" | "kids" | "story" | null;
}

/** A voice this grown-up recorded (even one still being made), or a ready storyteller's voice shared with the family. */
export function hasReadingVoice(state: FamilyState, adultId: string, home: string): boolean {
  return state.voices.some(
    (v) => v.deletedAt === null && (v.ownerId === adultId || (v.status === "ready" && activeShare(state, v.id, home) !== null)),
  );
}

/** Whether anyone else is in the family or has been invited: a co-parent or a storyteller. */
export function familyInvited(state: FamilyState, adultId: string, home: string, pendingInvites: number): boolean {
  return pendingInvites > 0 || state.members.some((m) => m.householdId === home && m.adultId !== adultId && m.removedAt === null);
}

/** Whether a first story has finished preparing, so it's ready to listen to. */
export function firstStoryReady(state: FamilyState, home: string): boolean {
  return state.jobs.some((j) => j.householdId === home && j.status === "done");
}

/** Whether the family has asked for any narration yet (being prepared or prepared). */
export function firstStoryChosen(state: FamilyState, home: string): boolean {
  return state.jobs.some((j) => j.householdId === home && j.status !== "failed" && j.status !== "canceled");
}

export const SETUP_TOTAL = 5;

export function setupProgress({ voice, kids, story, family = false, listen = false }: { voice: boolean; kids: boolean; story: boolean; family?: boolean; listen?: boolean }): SetupProgress {
  const next = !voice ? "voice" : !kids ? "kids" : !story ? "story" : null;
  return { voice, kids, story, done: [voice, kids, family, story, listen].filter(Boolean).length, next };
}

/**
 * The guided setup, one screen at a time: your voice, your kids, the rest of your family (a co-parent and
 * other storytellers), a first book, then listening to it together. Inviting is optional, so it never counts towards "done".
 */
export const SETUP_STEPS = ["voice", "kids", "family", "book", "listen"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number] | "done";

export const SETUP_STEP_LABELS: Record<(typeof SETUP_STEPS)[number], string> = {
  voice: "Voice",
  kids: "Kids",
  family: "Family",
  book: "Book",
  listen: "Listen",
};

/** The screen to show: the one asked for, or else the first essential step still to do. */
export function setupStep(asked: string | undefined, progress: SetupProgress): SetupStep {
  if (asked === "done" || (SETUP_STEPS as readonly string[]).includes(asked ?? "")) return asked as SetupStep;
  if (progress.next === "voice") return "voice";
  if (progress.next === "kids") return "kids";
  if (progress.next === "story") return "book";
  return "done";
}

/** The screen after this one. */
export function stepAfter(step: SetupStep): SetupStep {
  const i = (SETUP_STEPS as readonly string[]).indexOf(step);
  return i < 0 || i === SETUP_STEPS.length - 1 ? "done" : SETUP_STEPS[i + 1]!;
}

/** The screen before this one, or null on the first. */
export function stepBefore(step: SetupStep): SetupStep | null {
  if (step === "done") return SETUP_STEPS[SETUP_STEPS.length - 1]!;
  const i = (SETUP_STEPS as readonly string[]).indexOf(step);
  return i <= 0 ? null : SETUP_STEPS[i - 1]!;
}

/** The link to one setup screen. */
export function setupHref(step: SetupStep): string {
  return `/family/setup?step=${step}`;
}


/**
 * Whether this grown-up's own ready voice already reads to every one of their kids in this family: shared
 * with it, in a narrator slot, and approved for each child. Null when they have no ready voice yet.
 */
export function myVoiceForKids(state: FamilyState, adultId: string, home: string, plan: PlanConfig): { voiceId: string; on: boolean } | null {
  const voice = state.voices.find((v) => v.ownerId === adultId && v.status === "ready" && v.deletedAt === null);
  if (!voice) return null;
  const kids = state.children.filter((c) => c.householdId === home && c.deletedAt === null);
  const on =
    Boolean(activeShare(state, voice.id, home)) &&
    Boolean(activeSlot(state, voice.id, home, plan)) &&
    kids.every((k) => activeApproval(state, voice.id, k.id, plan) !== null);
  return { voiceId: voice.id, on };
}

/**
 * The free storyteller's walkthrough: a welcome page, then record your voice, share it with a family, and hear
 * it read. Mirrors family setup (src/lib/family/setup.ts) with its own, shorter steps.
 */
export const STORYTELLER_STEPS = ["voice", "share", "listen"] as const;
export type StorytellerStep = "welcome" | (typeof STORYTELLER_STEPS)[number] | "done";

export const STORYTELLER_STEP_LABELS: Record<(typeof STORYTELLER_STEPS)[number], string> = {
  voice: "Voice",
  share: "Share",
  listen: "Listen",
};

export interface StorytellerProgress {
  /** A voice is kept (ready or still being made). */
  voice: boolean;
  /** Shared with at least one family. */
  shared: boolean;
}

/** The screen to show: the one asked for, or else the welcome page for someone new, or the first step still to do. */
export function storytellerStep(asked: string | undefined, progress: StorytellerProgress): StorytellerStep {
  if (asked === "welcome" || asked === "done" || (STORYTELLER_STEPS as readonly string[]).includes(asked ?? "")) return asked as StorytellerStep;
  if (!progress.voice) return "welcome";
  return progress.shared ? "listen" : "share";
}

/** The screen after this one. */
export function storytellerStepAfter(step: StorytellerStep): StorytellerStep {
  if (step === "welcome") return "voice";
  const i = (STORYTELLER_STEPS as readonly string[]).indexOf(step);
  return i < 0 || i === STORYTELLER_STEPS.length - 1 ? "done" : STORYTELLER_STEPS[i + 1]!;
}

/** The screen before this one: the first step goes back to the welcome page. */
export function storytellerStepBefore(step: StorytellerStep): StorytellerStep | null {
  if (step === "welcome") return null;
  if (step === "done") return STORYTELLER_STEPS[STORYTELLER_STEPS.length - 1]!;
  const i = (STORYTELLER_STEPS as readonly string[]).indexOf(step);
  return i <= 0 ? "welcome" : STORYTELLER_STEPS[i - 1]!;
}

/** The link to one storyteller setup screen. */
export function storytellerHref(step: StorytellerStep): string {
  return `/voice/setup?step=${step}`;
}

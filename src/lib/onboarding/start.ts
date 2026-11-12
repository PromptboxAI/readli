/**
 * The welcome a new grown-up gets after signing up by email or Google, before anything is bought: what to
 * call them, their family's name, their voice, hearing it read a story, then choosing a plan. Invited
 * storytellers skip it (they join the family that invited them), and Family signup from the pricing page
 * goes straight to checkout.
 */
export const START_STEPS = ["name", "family", "voice", "listen", "plan"] as const;
export type StartStep = (typeof START_STEPS)[number];

export const START_STEP_LABELS: Record<StartStep, string> = {
  name: "You",
  family: "Family",
  voice: "Voice",
  listen: "Listen",
  plan: "Plan",
};

/** The family name typed during the welcome, kept until the family is started at checkout. */
export const FAMILY_NAME_COOKIE = "readli_family_name";

/** Set when a new grown-up chooses to stay on free Readli Voice, so Family Home stops sending them back to the welcome. */
export const START_CHOSE_VOICE_COOKIE = "readli_chose_voice";

export const FAMILY_NAME_MAX = 60;

export interface StartProgress {
  familyNamed: boolean;
  voice: boolean;
}

/**
 * The screen to show: the one asked for, or else where they left off. The name step always comes first for
 * someone new, even with a name from Google, which may be a nickname or a business.
 */
export function startStep(asked: string | undefined, progress: StartProgress): StartStep {
  if ((START_STEPS as readonly string[]).includes(asked ?? "")) return asked as StartStep;
  if (!progress.familyNamed) return "name";
  if (!progress.voice) return "voice";
  return "listen";
}

/** The link to one welcome screen. The plan step is its own page. */
export function startHref(step: StartStep): string {
  return step === "plan" ? "/start/plan" : `/start?step=${step}`;
}

export function startStepAfter(step: StartStep): StartStep | null {
  const i = START_STEPS.indexOf(step);
  return i < 0 || i === START_STEPS.length - 1 ? null : START_STEPS[i + 1]!;
}

export function startStepBefore(step: StartStep): StartStep | null {
  const i = START_STEPS.indexOf(step);
  return i <= 0 ? null : START_STEPS[i - 1]!;
}

/**
 * The family-name cookie holds the account's id with the name, so the name belongs to the account that typed
 * it, not the browser: someone else signing up on the same browser starts at the beginning.
 */
export function familyNameCookie(userId: string, name: string): string {
  return `${userId}:${encodeURIComponent(name)}`;
}

/** The family name this account typed, from the cookie, or null when there is none or another account typed it. */
export function familyNameFor(raw: string | undefined, userId: string): string | null {
  if (!raw) return null;
  const prefix = `${userId}:`;
  if (!raw.startsWith(prefix)) return null;
  try {
    return cleanFamilyName(decodeURIComponent(raw.slice(prefix.length)));
  } catch {
    return null;
  }
}

/** A family name from the form or the cookie: trimmed, one line, at most 60 characters, or null. */
export function cleanFamilyName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim().slice(0, FAMILY_NAME_MAX);
  return name || null;
}

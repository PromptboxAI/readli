import { DEFAULT_PLAN, type PlanConfig } from "@/lib/family/plan";

/** Separately verified adults in one free contributor household (e.g. Grandma and Grandpa). */
export const CONTRIBUTOR_HOUSEHOLD_MAX_ADULTS = 2;

/**
 * Account types (Final Signup Architecture amendment, Kevin 2026-10-10).
 *
 * One adult identity, whatever they sign up as. "Readli Family" (paid) and "Readli Voice" (free)
 * describe the household an adult belongs to, not separate logins, so a contributor who later starts
 * a family keeps the same identity, voice and sharing permissions. Readli Kids is the child-facing
 * side of Readli Family, never an account type.
 */
export type HouseholdKind = "family" | "contributor";

export const ACCOUNT_TYPES = {
  family: {
    name: "Readli Family",
    cta: "Create a Family",
    includes: [
      "Two family narrator slots",
      "Up to six child profiles",
      "Three kids listening at once",
      "The Readli Kids library",
      "You approve narrators for each child",
      "Unlimited family invitations",
      "Each child's own history, favorites and progress",
    ],
  },
  voice: {
    name: "Readli Voice",
    cta: "Share Your Voice",
    includes: [
      "Free account",
      "One verified voice of your own",
      "Guided recording with a teleprompter",
      "A short preview of your voice",
      "Replace or delete your voice any time",
      "Approve or stop sharing with each family",
      "See which families can use your voice",
    ],
    excludes: ["The full storybook library", "Child profiles", "Family listening features", "Unlimited narration for personal use"],
  },
} as const;

export interface Identity {
  id: string;
  email: string;
  displayName: string;
  verifiedAt: string | null;
}

export interface Membership {
  householdId: string;
  identityId: string;
}

export interface AccountHousehold {
  id: string;
  kind: HouseholdKind;
}

/** One voice record per adult, shared by reference with any number of households. */
export interface OwnedVoice {
  id: string;
  ownerId: string;
  deletedAt: string | null;
}

export function canCreateVoice(identity: Identity, voices: readonly OwnedVoice[], config: PlanConfig = DEFAULT_PLAN) {
  if (!identity.verifiedAt) return { ok: false as const, reason: "unverified" as const, message: "Verify your identity before recording." };
  const owned = voices.filter((v) => v.ownerId === identity.id && v.deletedAt === null).length;
  if (owned >= config.freeContributorVoices) {
    return { ok: false as const, reason: "voice_limit" as const, message: "You already have a voice. You can replace it instead." };
  }
  return { ok: true as const };
}

/** Each adult in a free contributor household verifies and controls their own voice. */
export function canJoinContributorHousehold(memberCount: number) {
  return memberCount < CONTRIBUTOR_HOUSEHOLD_MAX_ADULTS;
}

/**
 * A contributor starts Readli Family: the same household turns into a family household.
 * The identity, the voice and every share with other families are untouched.
 */
export function upgradeToFamily(household: AccountHousehold): AccountHousehold {
  return { ...household, kind: "family" };
}

// ---------------------------------------------------------------------------
// Where a signup goes
// ---------------------------------------------------------------------------

export type SignupStart =
  | { kind: "choose" }
  | { kind: "family" }
  | { kind: "voice"; invitation: string | null }
  | { kind: "accept_invitation"; invitation: string };

/**
 * Invitation links go straight to Readli Voice onboarding. People who already have Readli accept
 * with the identity they have, so nobody ends up with two.
 */
export function signupStart(input: { invitation?: string | null; signedIn: boolean; choice?: string | null }): SignupStart {
  const invitation = input.invitation?.trim() || null;
  if (invitation) return input.signedIn ? { kind: "accept_invitation", invitation } : { kind: "voice", invitation };
  if (input.choice === "family") return { kind: "family" };
  if (input.choice === "voice") return { kind: "voice", invitation: null };
  return { kind: "choose" };
}

export function signupPath(start: SignupStart): string {
  switch (start.kind) {
    case "choose":
      return "/signup";
    case "family":
      return "/signup/family";
    case "voice":
      // An invitation always lands on the join page, which signs in, accepts and records in order.
      return start.invitation ? `/voice/join?invite=${encodeURIComponent(start.invitation)}` : "/signup/voice";
    case "accept_invitation":
      return `/voice/join?invite=${encodeURIComponent(start.invitation)}`;
  }
}

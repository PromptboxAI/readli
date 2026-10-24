import type { FamilyState } from "./model";

/**
 * Preview household for local dev and tests, matching the homepage example family. Nothing here is
 * a real person. The family is on Readli Family with two extra narrator slots (four in all), held by
 * Mom, Dad, Grandma June and Nana Rose. Priya has shared but isn't in a slot; Lou has recorded but
 * not shared; Sam's voice is still being made.
 */
export const DEMO_HOUSEHOLD_ID = "home-demo";
export const DEMO_POLICY_VERSION = "family-voice-2026-10";

const T0 = "2026-10-01T12:00:00.000Z";
const T1 = "2026-10-02T12:00:00.000Z";

export function demoFamilyState(): FamilyState {
  const adults = [
    { id: "sara", displayName: "Mom", relationship: "Sara, parent", tint: "bg-coral", role: "guardian" as const },
    { id: "ben", displayName: "Dad", relationship: "Ben, parent", tint: "bg-sky", role: "guardian" as const },
    { id: "june", displayName: "Grandma June", relationship: "Mom's mom", tint: "bg-lavender", role: "member" as const },
    { id: "lou", displayName: "Grandpa Lou", relationship: "Mom's dad", tint: "bg-sky", role: "member" as const },
    { id: "rose", displayName: "Nana Rose", relationship: "Dad's mom", tint: "bg-mint", role: "member" as const },
    { id: "priya", displayName: "Aunt Priya", relationship: "Mom's sister", tint: "bg-sunshine", role: "member" as const },
    { id: "sam", displayName: "Uncle Sam", relationship: "Dad's brother", tint: "bg-lavender", role: "member" as const },
  ];
  const shared = ["sara", "ben", "june", "rose", "priya"];
  const slotted = ["sara", "ben", "june", "rose"];
  const approvals: [string, string][] = [
    ["maya", "sara"],
    ["maya", "june"],
    ["leo", "sara"],
    ["leo", "ben"],
    ["leo", "rose"],
  ];
  return {
    households: [{ id: DEMO_HOUSEHOLD_ID, name: "Our family" }],
    adults: adults.map((a) => ({ id: a.id, displayName: a.displayName, relationship: a.relationship, tint: a.tint, avatarUrl: null })),
    members: adults.map((a) => ({ householdId: DEMO_HOUSEHOLD_ID, adultId: a.id, role: a.role, joinedAt: T0, removedAt: null })),
    children: [
      { id: "maya", householdId: DEMO_HOUSEHOLD_ID, nickname: "Maya", tint: "bg-coral", guardianIds: ["sara", "ben"], deletedAt: null },
      { id: "leo", householdId: DEMO_HOUSEHOLD_ID, nickname: "Leo", tint: "bg-sunshine", guardianIds: ["sara", "ben"], deletedAt: null },
    ],
    voices: adults.map((a) => ({
      id: `voice-${a.id}`,
      ownerId: a.id,
      version: 1,
      status: a.id === "sam" ? ("processing" as const) : ("ready" as const),
      createdAt: T0,
      deletedAt: null,
    })),
    shares: shared.map((id) => ({
      id: `share-${id}`,
      voiceId: `voice-${id}`,
      householdId: DEMO_HOUSEHOLD_ID,
      grantedBy: id,
      policyVersion: DEMO_POLICY_VERSION,
      grantedAt: T0,
      revokedAt: null,
      revokedBy: null,
    })),
    approvals: approvals.map(([child, owner]) => ({
      id: `approval-${child}-${owner}`,
      voiceId: `voice-${owner}`,
      childId: child,
      approvedBy: "sara",
      approvedAt: T1,
      revokedAt: null,
      revokedBy: null,
      revokeReason: null,
    })),
    audit: [],
    entitlements: [
      { id: "plan-demo", householdId: DEMO_HOUSEHOLD_ID, source: "subscription", status: "active", extraNarratorSlots: 2, extraStreams: 0, startsAt: T0, endsAt: null },
    ],
    slots: slotted.map((id) => ({
      id: `slot-${id}`,
      householdId: DEMO_HOUSEHOLD_ID,
      voiceId: `voice-${id}`,
      activatedBy: "sara",
      activatedAt: T0,
      releasedAt: null,
      releasedBy: null,
    })),
    sessions: [],
    progress: [],
    adultProgress: [],
    favorites: [],
    libraries: [],
    segments: [],
    jobs: [],
    creditLots: [],
    ledger: [],
    usage: [],
    notifications: [],
    requests: [],
    plays: [],
  };
}

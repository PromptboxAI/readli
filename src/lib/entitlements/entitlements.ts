import { DEFAULT_PLAN, type PlanConfig } from "./config";

/**
 * Household entitlements (pure, dependency-free so any store can call them).
 *
 * Only Readli Family households (paid, gifted or donated) get narrator slots, child profiles and
 * listening streams. Readli Voice contributors never need a subscription to share their voice, and
 * are never charged for being added to more households: the listening household pays for its slots.
 *
 * A child hears a family voice only when ALL of these hold, each checked separately:
 *   1. the voice owner shares it with the household (owner consent, the family permission engine),
 *   2. the household has activated it in a narrator slot (this module), and
 *   3. a guardian approved it for that child (the family permission engine).
 * Invitations, payment and family-tree relationships grant none of them.
 */

export type SubscriptionSource = "paid" | "gift" | "donated";
export type SubscriptionStatus = "active" | "past_due" | "cancelled" | "expired";

export interface HouseholdSubscription {
  householdId: string;
  source: SubscriptionSource;
  status: SubscriptionStatus;
  /** ISO time the current paid or gifted period ends. */
  paidThrough: string;
  /** Extra active narrator slots bought on top of the included ones. */
  extraNarratorSlots: number;
}

export interface Entitlements {
  family: boolean;
  narratorSlots: number;
  maxChildProfiles: number;
  concurrentStreams: number;
}

const NONE: Entitlements = { family: false, narratorSlots: 0, maxChildProfiles: 0, concurrentStreams: 0 };

export function isLive(sub: HouseholdSubscription | null, now: Date): sub is HouseholdSubscription {
  return !!sub && (sub.status === "active" || sub.status === "past_due") && new Date(sub.paidThrough).getTime() > now.getTime();
}

/** Gifts and donated memberships use exactly the same entitlements as a paid plan. */
export function entitlementsFor(sub: HouseholdSubscription | null, now: Date, config: PlanConfig = DEFAULT_PLAN): Entitlements {
  if (!isLive(sub, now)) return NONE;
  return {
    family: true,
    narratorSlots: config.includedNarratorSlots + Math.max(0, sub.extraNarratorSlots),
    maxChildProfiles: config.maxChildProfiles,
    concurrentStreams: config.includedConcurrentStreams,
  };
}

/** Monthly charge for a paid household. Never depends on how many children it has. */
export function monthlyChargeCents(sub: Pick<HouseholdSubscription, "source" | "extraNarratorSlots">, config: PlanConfig = DEFAULT_PLAN): number {
  const slots = Math.max(0, sub.extraNarratorSlots) * config.extraNarratorSlotPriceCents;
  return sub.source === "paid" ? config.familyMonthlyPriceCents + slots : slots;
}

export function extraSlotsForSale(config: PlanConfig = DEFAULT_PLAN): boolean {
  return config.extraNarratorSlotPriceStatus === "approved";
}

// ---------------------------------------------------------------------------
// Child profiles
// ---------------------------------------------------------------------------

export type Denied<R extends string> = { ok: false; reason: R; message: string };
export type Allowed<T = object> = { ok: true } & T;

export function canAddChildProfile(activeChildren: number, ent: Entitlements): Allowed | Denied<"no_family_plan" | "child_limit"> {
  if (!ent.family) return { ok: false, reason: "no_family_plan", message: "Child profiles come with Readli Family." };
  if (activeChildren >= ent.maxChildProfiles) {
    return { ok: false, reason: "child_limit", message: `Readli Family includes up to ${ent.maxChildProfiles} child profiles.` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Narrator slots
// ---------------------------------------------------------------------------

/** One voice active in one household. The voice record itself is never copied per household. */
export interface NarratorActivation {
  householdId: string;
  voiceId: string;
  activatedBy: string;
  activatedAt: string;
  deactivatedAt: string | null;
}

export type ActivateDenied = "no_family_plan" | "no_owner_consent" | "already_active" | "no_free_slot" | "swap_limit";

const MONTH_MS = 30 * 86_400_000;

export function activeNarrators(activations: readonly NarratorActivation[], householdId: string): NarratorActivation[] {
  return activations.filter((a) => a.householdId === householdId && a.deactivatedAt === null);
}

/**
 * Can this household put this voice in a narrator slot? Owner consent is checked first and
 * separately; having a free slot or paying never substitutes for it.
 */
export interface ActivateInput {
  householdId: string;
  voiceId: string;
  /** Key 1 from the permission engine: the owner currently shares this voice with this household. */
  ownerSharesWithHousehold: boolean;
  ent: Entitlements;
  now: Date;
  config?: PlanConfig;
}

export function canActivateNarrator(input: ActivateInput & { activations: readonly NarratorActivation[] }): Allowed | Denied<ActivateDenied> {
  const config = input.config ?? DEFAULT_PLAN;
  if (!input.ent.family) return { ok: false, reason: "no_family_plan", message: "Narrator slots come with Readli Family." };
  if (!input.ownerSharesWithHousehold) {
    return { ok: false, reason: "no_owner_consent", message: "The voice owner hasn't shared this voice with your family." };
  }
  const active = activeNarrators(input.activations, input.householdId);
  if (active.some((a) => a.voiceId === input.voiceId)) return { ok: false, reason: "already_active", message: "This narrator is already active." };
  if (active.length >= input.ent.narratorSlots) {
    return { ok: false, reason: "no_free_slot", message: `All ${input.ent.narratorSlots} narrator slots are in use. Free one or add a slot.` };
  }
  const recent = input.activations.filter(
    (a) => a.householdId === input.householdId && input.now.getTime() - new Date(a.activatedAt).getTime() < MONTH_MS,
  ).length;
  if (recent >= input.ent.narratorSlots + config.narratorSwapsPer30Days) {
    return { ok: false, reason: "swap_limit", message: "You've changed narrators a lot this month. Try again in a few days." };
  }
  return { ok: true };
}

export function activateNarrator(
  activations: readonly NarratorActivation[],
  input: ActivateInput & { adultId: string },
): { ok: true; activations: NarratorActivation[] } | Denied<ActivateDenied> {
  const check = canActivateNarrator({ ...input, activations });
  if (!check.ok) return check;
  return {
    ok: true,
    activations: [
      ...activations,
      { householdId: input.householdId, voiceId: input.voiceId, activatedBy: input.adultId, activatedAt: input.now.toISOString(), deactivatedAt: null },
    ],
  };
}

/** Frees a slot. Child approvals stay recorded but can't play until the voice is active again. */
export function deactivateNarrator(activations: readonly NarratorActivation[], householdId: string, voiceId: string, now: Date): NarratorActivation[] {
  return activations.map((a) =>
    a.householdId === householdId && a.voiceId === voiceId && a.deactivatedAt === null ? { ...a, deactivatedAt: now.toISOString() } : a,
  );
}

/** Reassign a slot from one authorized voice to another, under the same anti-abuse limit. */
export function reassignSlot(
  activations: readonly NarratorActivation[],
  input: ActivateInput & { adultId: string; fromVoiceId: string },
): ReturnType<typeof activateNarrator> {
  return activateNarrator(deactivateNarrator(activations, input.householdId, input.fromVoiceId, input.now), input);
}

/** Over-limit after a downgrade or lapse: the oldest activations stay, the rest pause. */
export function narratorsOverLimit(activations: readonly NarratorActivation[], householdId: string, ent: Entitlements): NarratorActivation[] {
  const active = activeNarrators(activations, householdId).sort((a, b) => a.activatedAt.localeCompare(b.activatedAt));
  return active.slice(ent.narratorSlots);
}

/** All three keys, each independent. */
export function narratorPlayable(keys: { ownerShares: boolean; activeInHousehold: boolean; withinSlotLimit: boolean; parentApprovedForChild: boolean }): boolean {
  return keys.ownerShares && keys.activeInHousehold && keys.withinSlotLimit && keys.parentApprovedForChild;
}

// ---------------------------------------------------------------------------
// Concurrent child listening sessions
// ---------------------------------------------------------------------------

export interface StreamLease {
  householdId: string;
  childId: string;
  deviceId: string;
  heartbeatAt: string;
}

/** A player that stops sending heartbeats frees its stream after this long. */
export const STREAM_STALE_MS = 90_000;

export function liveLeases(leases: readonly StreamLease[], householdId: string, now: Date): StreamLease[] {
  return leases.filter((l) => l.householdId === householdId && now.getTime() - new Date(l.heartbeatAt).getTime() < STREAM_STALE_MS);
}

/**
 * Start (or keep) a child's listening session. Each child has one session; opening the player on a
 * second device moves that child's session rather than using another stream.
 */
export function acquireStream(
  leases: readonly StreamLease[],
  input: { householdId: string; childId: string; deviceId: string; ent: Entitlements; now: Date },
): { ok: true; leases: StreamLease[] } | Denied<"no_family_plan" | "stream_limit"> {
  if (!input.ent.family) return { ok: false, reason: "no_family_plan", message: "Listening comes with Readli Family." };
  const others = liveLeases(leases, input.householdId, input.now).filter((l) => l.childId !== input.childId);
  if (others.length >= input.ent.concurrentStreams) {
    return {
      ok: false,
      reason: "stream_limit",
      message: `${input.ent.concurrentStreams} children are already listening. Try again when one of them finishes.`,
    };
  }
  const kept = leases.filter(
    (l) => !(l.householdId === input.householdId && l.childId === input.childId) && input.now.getTime() - new Date(l.heartbeatAt).getTime() < STREAM_STALE_MS,
  );
  return {
    ok: true,
    leases: [...kept, { householdId: input.householdId, childId: input.childId, deviceId: input.deviceId, heartbeatAt: input.now.toISOString() }],
  };
}

export function releaseStream(leases: readonly StreamLease[], householdId: string, childId: string): StreamLease[] {
  return leases.filter((l) => !(l.householdId === householdId && l.childId === childId));
}

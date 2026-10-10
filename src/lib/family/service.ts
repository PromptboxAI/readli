import { randomUUID } from "node:crypto";
import type { Actor, AuditAction, FamilyState, NarrationAsset } from "./model";
import {
  activeChild,
  activeShare,
  approvedVoiceIds,
  childVoiceAccess,
  isActiveMember,
  isGuardianOf,
  readyVoice,
  storytellerStatus,
  type StorytellerStatus,
} from "./permissions";

/**
 * Server-side family voice service. Route handlers resolve the signed-in actor and call these;
 * nothing here trusts the browser about who may hear what.
 */

export class PermissionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** Safe to show in the app. */
    readonly userMessage: string,
  ) {
    super(code);
  }
}

const SIGN_IN = new PermissionError(401, "sign_in_required", "Please sign in as a grown-up to continue.");
const ADULTS_ONLY = new PermissionError(403, "adults_only", "Only a parent or guardian can change storytellers.");
const NOT_GUARDIAN = new PermissionError(403, "not_guardian", "Only this child's parent or guardian can manage their storytellers.");
const NOT_OWNER = new PermissionError(403, "not_owner", "Only the person whose voice it is can share it.");
const NOT_AVAILABLE = new PermissionError(403, "voice_not_available", "That storyteller isn't available right now.");

export interface FamilyStore {
  read(): Promise<FamilyState>;
  write(mutate: (state: FamilyState) => void): Promise<void>;
}

export class MemoryFamilyStore implements FamilyStore {
  constructor(private state: FamilyState) {}
  async read() {
    return this.state;
  }
  async write(mutate: (state: FamilyState) => void) {
    mutate(this.state);
  }
}

type Clock = () => Date;
const now: Clock = () => new Date();

function audit(state: FamilyState, actor: string, action: AuditAction, at: string, rest: { voiceId: string; childId?: string; householdId?: string; detail?: string }) {
  state.audit.push({
    id: randomUUID(),
    at,
    actor,
    action,
    voiceId: rest.voiceId,
    childId: rest.childId ?? null,
    householdId: rest.householdId ?? null,
    detail: rest.detail ?? null,
  });
}

function requireAdult(actor: Actor | null): string {
  if (!actor) throw SIGN_IN;
  if (actor.kind !== "adult") throw ADULTS_ONLY;
  return actor.adultId;
}

// ---------------------------------------------------------------------------
// Voice owner: key 1
// ---------------------------------------------------------------------------

export interface MyVoiceView {
  voiceId: string;
  status: string;
  households: { id: string; name: string; shared: boolean }[];
}

export async function myVoices(store: FamilyStore, actor: Actor | null): Promise<MyVoiceView[]> {
  const adultId = requireAdult(actor);
  const state = await store.read();
  const homes = state.members.filter((m) => m.adultId === adultId && m.removedAt === null);
  return state.voices
    .filter((v) => v.ownerId === adultId && v.deletedAt === null)
    .map((v) => ({
      voiceId: v.id,
      status: v.status,
      households: homes.map((m) => ({
        id: m.householdId,
        name: state.households.find((h) => h.id === m.householdId)?.name ?? "Family",
        shared: activeShare(state, v.id, m.householdId) !== null,
      })),
    }));
}

/**
 * Turns the owner's household share on or off. Turning it off also revokes every child approval
 * for that household, so sharing again starts disabled for every child.
 */
export async function setHouseholdShare(
  store: FamilyStore,
  actor: Actor | null,
  input: { voiceId: string; householdId: string; shared: boolean; policyVersion: string },
  clock: Clock = now,
): Promise<void> {
  const adultId = requireAdult(actor);
  const state = await store.read();
  const voice = state.voices.find((v) => v.id === input.voiceId && v.deletedAt === null);
  if (!voice || voice.ownerId !== adultId) throw NOT_OWNER;
  if (!isActiveMember(state, adultId, input.householdId)) throw new PermissionError(403, "not_member", "You aren't part of that family.");
  if (input.shared && voice.status !== "ready") throw new PermissionError(409, "voice_not_ready", "Your voice is still being made.");

  const at = clock().toISOString();
  await store.write((s) => {
    const current = s.shares.find((x) => x.voiceId === voice.id && x.householdId === input.householdId && x.revokedAt === null);
    if (input.shared) {
      if (current) return;
      s.shares.push({
        id: randomUUID(),
        voiceId: voice.id,
        householdId: input.householdId,
        grantedBy: adultId,
        policyVersion: input.policyVersion,
        grantedAt: at,
        revokedAt: null,
        revokedBy: null,
      });
      audit(s, adultId, "voice_shared", at, { voiceId: voice.id, householdId: input.householdId });
      return;
    }
    if (!current) return;
    current.revokedAt = at;
    current.revokedBy = adultId;
    const kids = new Set(s.children.filter((c) => c.householdId === input.householdId).map((c) => c.id));
    for (const a of s.approvals) {
      if (a.voiceId === voice.id && kids.has(a.childId) && a.revokedAt === null) {
        a.revokedAt = at;
        a.revokedBy = adultId;
        a.revokeReason = "owner_revoked";
      }
    }
    audit(s, adultId, "voice_unshared", at, { voiceId: voice.id, householdId: input.householdId });
  });
}

// ---------------------------------------------------------------------------
// Guardian: key 2 (Manage Storytellers)
// ---------------------------------------------------------------------------

export interface StorytellerView {
  voiceId: string;
  ownerName: string;
  relationship: string;
  avatarUrl: string | null;
  tint: string;
  status: StorytellerStatus;
}

export interface ManageStorytellersView {
  child: { id: string; nickname: string; tint: string };
  children: { id: string; nickname: string }[];
  storytellers: StorytellerView[];
}

export async function manageStorytellers(store: FamilyStore, actor: Actor | null, childId: string): Promise<ManageStorytellersView> {
  const adultId = requireAdult(actor);
  const state = await store.read();
  if (!isGuardianOf(state, adultId, childId)) throw NOT_GUARDIAN;
  const child = activeChild(state, childId)!;
  const storytellers: StorytellerView[] = [];
  for (const voice of state.voices) {
    const status = storytellerStatus(state, childId, voice.id);
    if (!status) continue;
    const owner = state.adults.find((a) => a.id === voice.ownerId)!;
    storytellers.push({
      voiceId: voice.id,
      ownerName: owner.displayName,
      relationship: owner.relationship,
      avatarUrl: owner.avatarUrl,
      tint: owner.tint,
      status,
    });
  }
  const order: StorytellerStatus[] = ["approved", "available", "waiting_for_owner", "processing"];
  storytellers.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.ownerName.localeCompare(b.ownerName));
  return {
    child: { id: child.id, nickname: child.nickname, tint: child.tint },
    children: state.children
      .filter((c) => c.deletedAt === null && isGuardianOf(state, adultId, c.id))
      .map((c) => ({ id: c.id, nickname: c.nickname })),
    storytellers,
  };
}

/** Approves or removes one or more voices for one child. Approval needs the owner's live share. */
export async function setChildApprovals(
  store: FamilyStore,
  actor: Actor | null,
  childId: string,
  changes: { voiceId: string; approved: boolean }[],
  clock: Clock = now,
): Promise<void> {
  const adultId = requireAdult(actor);
  const state = await store.read();
  if (!isGuardianOf(state, adultId, childId)) throw NOT_GUARDIAN;
  const child = activeChild(state, childId)!;
  for (const c of changes) {
    if (c.approved && !activeShare(state, c.voiceId, child.householdId)) {
      throw new PermissionError(409, "waiting_for_owner", "This storyteller hasn't shared their voice with your family yet.");
    }
  }
  const at = clock().toISOString();
  await store.write((s) => {
    for (const c of changes) {
      const current = s.approvals.find((a) => a.voiceId === c.voiceId && a.childId === childId && a.revokedAt === null);
      if (c.approved && !current) {
        s.approvals.push({
          id: randomUUID(),
          voiceId: c.voiceId,
          childId,
          approvedBy: adultId,
          approvedAt: at,
          revokedAt: null,
          revokedBy: null,
          revokeReason: null,
        });
        audit(s, adultId, "child_voice_approved", at, { voiceId: c.voiceId, childId });
      } else if (!c.approved && current) {
        current.revokedAt = at;
        current.revokedBy = adultId;
        current.revokeReason = "guardian_removed";
        audit(s, adultId, "child_voice_removed", at, { voiceId: c.voiceId, childId });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Readli Kids: only approved narrators, checked on every request
// ---------------------------------------------------------------------------

export interface NarratorView {
  voiceId: string;
  name: string;
  avatarUrl: string | null;
  tint: string;
}

/** A child may read their own narrators; a guardian may read them for a child they manage. */
function requireChildAccess(state: FamilyState, actor: Actor | null, childId: string) {
  if (!actor) throw SIGN_IN;
  if (actor.kind === "child" ? actor.childId !== childId : !isGuardianOf(state, actor.adultId, childId)) {
    throw new PermissionError(403, "not_this_child", "This isn't your bookshelf.");
  }
  if (!activeChild(state, childId)) throw new PermissionError(404, "no_child", "We couldn't find that profile.");
}

export async function narratorsFor(store: FamilyStore, actor: Actor | null, childId: string): Promise<NarratorView[]> {
  const state = await store.read();
  requireChildAccess(state, actor, childId);
  return approvedVoiceIds(state, childId).map((voiceId) => {
    const owner = state.adults.find((a) => a.id === readyVoice(state, voiceId)!.ownerId)!;
    return { voiceId, name: owner.displayName, avatarUrl: owner.avatarUrl, tint: owner.tint };
  });
}

function actorLabel(actor: Actor): string {
  return actor.kind === "adult" ? actor.adultId : `child:${actor.childId}`;
}

/** Checks both keys before any audio is generated; logs the decision either way. */
export async function authorizeNarration(
  store: FamilyStore,
  actor: Actor | null,
  input: { childId: string; voiceId: string; bookSlug: string; sentence: number },
  clock: Clock = now,
): Promise<NarrationAsset> {
  const state = await store.read();
  requireChildAccess(state, actor, input.childId);
  const access = childVoiceAccess(state, input.childId, input.voiceId);
  const at = clock().toISOString();
  if (!access.allowed) {
    await store.write((s) =>
      audit(s, actorLabel(actor!), "narration_denied", at, { voiceId: input.voiceId, childId: input.childId, detail: access.reason }),
    );
    throw NOT_AVAILABLE;
  }
  const asset: NarrationAsset = { id: randomUUID(), createdAt: at, ...input };
  await store.write((s) => {
    s.assets.push(asset);
    audit(s, actorLabel(actor!), "narration_authorized", at, { voiceId: input.voiceId, childId: input.childId, detail: input.bookSlug });
  });
  return asset;
}

/**
 * Re-checks both keys every time generated audio is fetched, so a revoked voice stops playing even
 * from audio made before the revocation. Unknown and forbidden assets look the same.
 */
export async function authorizeAssetPlayback(store: FamilyStore, actor: Actor | null, assetId: string): Promise<NarrationAsset> {
  const state = await store.read();
  if (!actor) throw SIGN_IN;
  const asset = state.assets.find((a) => a.id === assetId);
  if (!asset) throw NOT_AVAILABLE;
  try {
    requireChildAccess(state, actor, asset.childId);
  } catch {
    throw NOT_AVAILABLE;
  }
  if (!childVoiceAccess(state, asset.childId, asset.voiceId).allowed) throw NOT_AVAILABLE;
  return asset;
}

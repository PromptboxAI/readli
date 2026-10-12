import type { PlanTier } from "@/lib/family/model";
import { NOTICE_DAYS_LEFT, type RecoveryNotice } from "./notices";

/**
 * The daily lifecycle run, as a pure plan: who enters the 30-day recovery window, which reminder emails
 * are due, which households are cleaned up at the end of it, and which unused voice clones are retired.
 * The runner (run.ts) reads a snapshot, calls this, and carries out the actions. Keeping the decisions
 * here means the dry run, the real run and the tests can't disagree.
 *
 * Day-30 cleanup (Kevin, 2026-10-11, decision 2) removes what belongs to that household alone: its
 * saved stories no other household can play, its kids profiles and their listening progress, its
 * notifications and pending invitations, and recordings only it needed. It never removes narration or
 * recordings another Readli Family, Archive or recovering household needs, recordings whose agreement
 * still grants Readli development rights, or plans, credits, payments and audit records.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;

export interface LifecycleConfig {
  recoveryDays: number;
  /** The family always gets at least this many days' warning, even if the window started late. */
  minNoticeDays: number;
  /** Cleanup waits at least this long after the two-days-left reminder. */
  finalReminderLeadHours: number;
  /** A plan changed this recently may still be settling in billing webhooks: don't delete yet. */
  webhookQuietHours: number;
  cloneRetireAfterDays: number;
  /** Stop all deletions in a run that would delete more than this many households... */
  brakeMaxHouseholds: number;
  /** ...or more than this share of households that have ever had a plan. */
  brakeMaxFraction: number;
  maxCloneRetirements: number;
}

export const DEFAULT_LIFECYCLE: LifecycleConfig = {
  recoveryDays: 30,
  minNoticeDays: 11,
  finalReminderLeadHours: 24,
  webhookQuietHours: 48,
  cloneRetireAfterDays: 30,
  brakeMaxHouseholds: 25,
  brakeMaxFraction: 0.2,
  maxCloneRetirements: 50,
};

export interface SnapEntitlement {
  householdId: string;
  source: string;
  status: string;
  tier: PlanTier;
  startsAt: string;
  endsAt: string | null;
  updatedAt: string;
}

export interface SnapRecovery {
  householdId: string;
  accessEndedAt: string;
  deletionDueAt: string;
  status: "recovering" | "restored" | "held" | "deleted";
  /** When each email was queued, or "skipped". */
  notices: Partial<Record<RecoveryNotice, string>>;
}

export interface SnapVoice {
  id: string;
  status: string;
  hasClone: boolean;
  unlinkedSince: string | null;
  ownerId: string | null;
  /** Narration jobs for this voice are queued or running. */
  pendingJobs: boolean;
  /** The owner's agreement in force grants Readli development rights, so recordings are kept. */
  developmentRights: boolean;
  /** Original recordings are still in storage. */
  hasRecordings: boolean;
}

export interface LifecycleSnapshot {
  now: string;
  entitlements: SnapEntitlement[];
  recoveries: SnapRecovery[];
  /** Live shares: which households can play which voice. */
  shares: { voiceId: string; householdId: string }[];
  libraries: { key: string; voiceId: string; scope: string }[];
  voices: SnapVoice[];
  /** Active household memberships. */
  memberships: { userId: string; householdId: string }[];
  /**
   * Households whose billing provider still shows a live subscription (active, trialing, past_due,
   * unpaid, incomplete or paused): our own record may be wrong, so hold instead of deleting. A
   * household whose check failed is in `billingUnknown` and is skipped this run.
   */
  billingLive: string[];
  billingUnknown: string[];
}

export type LifecycleAction =
  | { kind: "start_recovery"; householdId: string; accessEndedAt: string; deletionDueAt: string }
  | { kind: "restore"; householdId: string; tier: PlanTier }
  | {
      kind: "notice";
      householdId: string;
      notice: RecoveryNotice;
      skipped: RecoveryNotice[];
      accessEndedAt: string;
      deletionDueAt: string;
      /** The deletion date moved to keep two full days after the final reminder. */
      moved?: boolean;
    }
  | { kind: "hold"; householdId: string; reason: string }
  | {
      kind: "clean_household";
      householdId: string;
      libraryKeys: string[];
      keptShared: number;
      /** Voices whose original recordings only this household needed. */
      recordingVoices: string[];
    }
  | { kind: "defer"; householdId: string; reason: string }
  | { kind: "unlink_voice"; voiceId: string }
  | { kind: "relink_voice"; voiceId: string }
  | { kind: "retire_clone"; voiceId: string; unlinkedSince: string };

export interface LifecyclePlan {
  actions: LifecycleAction[];
  /** Set when the mass-deletion brake stopped every deletion this run. */
  brake: { wouldDelete: number; households: number } | null;
}

const at = (iso: string) => new Date(iso).getTime();

function liveNow(e: SnapEntitlement, now: number): boolean {
  return e.status === "active" && at(e.startsAt) <= now && (e.endsAt === null || at(e.endsAt) > now);
}

/** When the household's last plan ended, if it had one: the latest end date, or the cancel time. */
function accessEnded(ents: SnapEntitlement[], now: number): number | null {
  const ended = ents.map((e) => (e.endsAt && at(e.endsAt) <= now ? at(e.endsAt) : e.status === "canceled" ? at(e.updatedAt) : null));
  const known = ended.filter((t): t is number => t !== null);
  return known.length ? Math.max(...known) : null;
}

function currentTier(ents: SnapEntitlement[], now: number): PlanTier | null {
  const live = ents.filter((e) => liveNow(e, now));
  if (!live.length) return null;
  return live.some((e) => e.tier === "family") ? "family" : "archive";
}

export function planLifecycleRun(snap: LifecycleSnapshot, config: LifecycleConfig = DEFAULT_LIFECYCLE): LifecyclePlan {
  const now = at(snap.now);
  const actions: LifecycleAction[] = [];
  const byHousehold = new Map<string, SnapEntitlement[]>();
  for (const e of snap.entitlements) byHousehold.set(e.householdId, [...(byHousehold.get(e.householdId) ?? []), e]);
  const recovery = new Map(snap.recoveries.map((r) => [r.householdId, r]));
  const tierOf = new Map([...byHousehold].map(([h, ents]) => [h, currentTier(ents, now)]));
  const billingLive = new Set(snap.billingLive);
  const billingUnknown = new Set(snap.billingUnknown);

  // Who can still play stored stories after this run: households with a plan, and households whose
  // window is still open (they may come back). Recovering households that are deleted this run are
  // taken out below.
  const keeps = new Set<string>();
  for (const [h, tier] of tierOf) if (tier) keeps.add(h);
  for (const r of snap.recoveries) if (r.status === "recovering" || r.status === "held") keeps.add(r.householdId);

  const deletions: { householdId: string }[] = [];

  for (const [householdId, ents] of byHousehold) {
    const tier = tierOf.get(householdId) ?? null;
    const r = recovery.get(householdId);
    if (tier) {
      if (r && (r.status === "recovering" || r.status === "held")) actions.push({ kind: "restore", householdId, tier });
      continue;
    }
    const ended = accessEnded(ents, now);
    if (ended === null) continue;
    // A new window starts when access ends for the first time, or again after a restore.
    if (!r || (r.status === "restored" && ended > at(r.accessEndedAt))) {
      const due = Math.max(ended + config.recoveryDays * DAY, now + config.minNoticeDays * DAY);
      const action = { kind: "start_recovery" as const, householdId, accessEndedAt: new Date(ended).toISOString(), deletionDueAt: new Date(due).toISOString() };
      actions.push(action);
      actions.push({ kind: "notice", householdId, notice: "day0", skipped: [], accessEndedAt: action.accessEndedAt, deletionDueAt: action.deletionDueAt });
      keeps.add(householdId);
      continue;
    }
    if (r.status !== "recovering") continue;

    const due = at(r.deletionDueAt);
    const notice = dueNotice(r, now);
    if (notice) {
      const { newDeletionDueAt, ...rest } = notice;
      actions.push({ kind: "notice", householdId, ...rest, accessEndedAt: r.accessEndedAt, deletionDueAt: newDeletionDueAt ?? r.deletionDueAt, moved: Boolean(newDeletionDueAt) });
      if (newDeletionDueAt) continue;
    }
    if (now < due) continue;

    const reminder = sentTime(r, "day28");
    if (billingUnknown.has(householdId)) actions.push({ kind: "defer", householdId, reason: "billing_check_failed" });
    else if (billingLive.has(householdId)) actions.push({ kind: "hold", householdId, reason: "billing_shows_live_subscription" });
    else if (reminder === null || now - reminder < config.finalReminderLeadHours * HOUR) actions.push({ kind: "defer", householdId, reason: "reminder_too_recent" });
    else if (ents.some((e) => now - at(e.updatedAt) < config.webhookQuietHours * HOUR)) actions.push({ kind: "defer", householdId, reason: "plan_changed_recently" });
    else deletions.push({ householdId });
  }

  const everPaid = byHousehold.size;
  const brakeTripped = deletions.length > config.brakeMaxHouseholds || (deletions.length > 1 && deletions.length > everPaid * config.brakeMaxFraction);
  let brake: LifecyclePlan["brake"] = null;
  if (brakeTripped) {
    brake = { wouldDelete: deletions.length, households: everPaid };
    for (const d of deletions) actions.push({ kind: "defer", householdId: d.householdId, reason: "mass_deletion_brake" });
  } else {
    for (const d of deletions) keeps.delete(d.householdId);
    for (const d of deletions) {
      // The household's own narration, and shared narration of voices nobody who stays can play.
      const own = snap.libraries.filter((l) => l.scope === d.householdId);
      const shared = snap.libraries.filter((l) => l.scope === "shared" && snap.shares.some((s) => s.voiceId === l.voiceId && s.householdId === d.householdId));
      const orphaned = shared.filter((l) => !snap.shares.some((s) => s.voiceId === l.voiceId && keeps.has(s.householdId)));
      const recordingVoices = snap.voices
        .filter((v) => v.hasRecordings && v.ownerId && !v.developmentRights && v.status !== "deleted")
        .filter((v) => {
          const homes = snap.memberships.filter((m) => m.userId === v.ownerId).map((m) => m.householdId);
          const onlyHere = homes.length > 0 && homes.every((h) => h === d.householdId);
          const neededElsewhere = snap.shares.some((s) => s.voiceId === v.id && s.householdId !== d.householdId && keeps.has(s.householdId));
          return onlyHere && !neededElsewhere && !v.pendingJobs;
        })
        .map((v) => v.id);
      actions.push({
        kind: "clean_household",
        householdId: d.householdId,
        libraryKeys: [...own, ...orphaned].map((l) => l.key),
        keptShared: shared.length - orphaned.length,
        recordingVoices,
      });
    }
  }

  // Clones are only needed to make new stories, which only Readli Family households do. Playback of
  // stored stories never needs one, so a voice no Family household has shared is "unlinked", and its
  // clone is retired once it has been unlinked long enough. The original recording stays; the clone
  // is made again from it if a Family household needs the voice and its authorization still holds.
  const family = new Set([...tierOf].filter(([, t]) => t === "family").map(([h]) => h));
  let retiring = 0;
  for (const v of snap.voices) {
    if (v.status !== "ready" && v.status !== "processing") continue;
    const linked = snap.shares.some((s) => s.voiceId === v.id && family.has(s.householdId));
    if (linked) {
      if (v.unlinkedSince) actions.push({ kind: "relink_voice", voiceId: v.id });
      continue;
    }
    if (!v.unlinkedSince) {
      actions.push({ kind: "unlink_voice", voiceId: v.id });
      continue;
    }
    if (v.hasClone && v.status === "ready" && !v.pendingJobs && now - at(v.unlinkedSince) >= config.cloneRetireAfterDays * DAY && retiring < config.maxCloneRetirements) {
      retiring += 1;
      actions.push({ kind: "retire_clone", voiceId: v.id, unlinkedSince: v.unlinkedSince });
    }
  }

  return { actions, brake };
}

/**
 * The reminder email due now, if any. Day 0 goes first, on its own. The ten-days-left (Day 20) email is
 * skipped if the two-days-left one is already due. The two-days-left (Day 28) reminder is never
 * skipped: if it goes out late, the deletion date moves so the family still gets two full days.
 */
export function dueNotice(
  r: SnapRecovery,
  now: number,
): { notice: RecoveryNotice; skipped: RecoveryNotice[]; newDeletionDueAt?: string } | null {
  if (!r.notices.day0) return { notice: "day0", skipped: [] };
  const due = at(r.deletionDueAt);
  if (!r.notices.day28 && now >= due - NOTICE_DAYS_LEFT.day28 * DAY) {
    const lead = NOTICE_DAYS_LEFT.day28 * DAY;
    const late = due - now < lead - HOUR;
    return { notice: "day28", skipped: r.notices.day20 ? [] : ["day20"], ...(late ? { newDeletionDueAt: new Date(now + lead).toISOString() } : {}) };
  }
  if (!r.notices.day20 && now >= due - NOTICE_DAYS_LEFT.day20 * DAY) return { notice: "day20", skipped: [] };
  return null;
}

/** When a notice was actually queued (null if not yet, or skipped). */
export function sentTime(r: SnapRecovery, n: RecoveryNotice): number | null {
  const v = r.notices[n];
  if (!v || v === "skipped") return null;
  const t = at(v);
  return Number.isNaN(t) ? null : t;
}

/** The Day-N label for a recovery date, counted from when access ended. */
export function recoveryDay(accessEndedAt: string, nowIso: string): number {
  return Math.floor((at(nowIso) - at(accessEndedAt)) / DAY);
}

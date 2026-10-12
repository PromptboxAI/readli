import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { effectivePlan } from "@/lib/billing/price-settings";
import { queueEmails, type SendReport } from "@/lib/email/outbox";
import { recordingsDeletedEmail } from "@/lib/email/templates";
import type { PlanConfig } from "@/lib/family/plan";
import { purchasedPacks, reconciliation } from "@/lib/billing/credit-refunds";
import { cleanHousehold, openException } from "./cleanup";
import { all, allIn, rows, run, writeAudit, type AuditEntry, type Row } from "./db";
import { deletedEmail, recoveryEmail } from "./notices";
import { carryOutRecordingDeletion, pendingRecordingDeletions, requestRecordingDeletion } from "./recordings";
import { DEFAULT_LIFECYCLE, planLifecycleRun, type LifecycleAction, type LifecycleConfig, type LifecycleSnapshot } from "./plan";

/**
 * Carries out the daily lifecycle plan against Supabase. Non-destructive steps (opening a recovery
 * window, queueing reminder emails, restoring a household that came back, marking voices unlinked)
 * always run. Destructive steps run only when switched on (LIFECYCLE_DELETION=on for Day-30 cleanup,
 * LIFECYCLE_CLONE_RETIREMENT=on for retiring unused clones, LIFECYCLE_RECORDING_DELETION=on for
 * carrying out recording deletion requests); otherwise they are logged as dry runs. Every step, real
 * or dry, goes to the lifecycle audit log under one run id, and each run is recorded in
 * lifecycle_runs, which also stops two runs overlapping. Every step is safe to repeat, so a failed or
 * interrupted run is simply retried the next day (or by calling the route again).
 */

const ACTOR = "lifecycle-job";
const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);

export interface LifecycleDeps {
  db: SupabaseClient;
  /** The household's billing subscription statuses, or null when payments are off. Throws on failure. */
  subscriptionStatuses: ((customerRef: string) => Promise<string[]>) | null;
  /** Deletes the provider clone for a voice (decrypting its id). */
  retireClone: ((voiceId: string) => Promise<boolean>) | null;
  billingUrl: string;
  deletion: boolean;
  cloneRetirement: boolean;
  recordingDeletion?: boolean;
  /** Sends due outbox emails after the run (null while email is off). */
  sendEmails?: (() => Promise<SendReport | null>) | null;
  config?: LifecycleConfig;
  plan?: PlanConfig;
  now?: () => Date;
}

export interface LifecycleReport {
  runId: string;
  dryRunDeletion: boolean;
  dryRunCloneRetirement: boolean;
  dryRunRecordingDeletion: boolean;
  /** Set when another run was still going, so this one did nothing. */
  skipped?: "already_running";
  counts: Record<string, number>;
  brake: { wouldDelete: number; households: number } | null;
  errors: string[];
}

export function lifecycleFlags(env: NodeJS.ProcessEnv = process.env): { deletion: boolean; cloneRetirement: boolean; recordingDeletion: boolean } {
  return {
    deletion: env.LIFECYCLE_DELETION === "on",
    cloneRetirement: env.LIFECYCLE_CLONE_RETIREMENT === "on",
    recordingDeletion: env.LIFECYCLE_RECORDING_DELETION === "on",
  };
}

async function loadSnapshot(deps: LifecycleDeps, now: Date): Promise<LifecycleSnapshot> {
  const { db } = deps;
  const [ents, recs, shares, libs, voices, jobs, members, rights, sessions] = await Promise.all([
    all(() => db.from("household_entitlements").select("household_id, source, status, tier, starts_at, ends_at, updated_at").order("id"), "read plans"),
    all(() => db.from("household_recovery").select("household_id, access_ended_at, deletion_due_at, status, notices").order("household_id"), "read recovery"),
    all(() => db.from("voice_household_shares").select("voice_id, household_id").is("revoked_at", null).order("id"), "read sharing"),
    all(() => db.from("narration_libraries").select("key, voice_id, scope").order("key"), "read narration"),
    all(() => db.from("voice_profiles").select("id, owner_id, status, provider_voice_id_encrypted, unlinked_since").in("status", ["processing", "ready", "withdrawn"]).order("id"), "read voices"),
    all(() => db.from("narration_jobs").select("id, library_key").in("status", ["queued", "running"]).order("id"), "read pending jobs"),
    all(() => db.from("household_members").select("user_id, household_id").is("removed_at", null).order("household_id"), "read members"),
    all(() => db.from("voice_rights_current").select("contributor_id, readli_development_rights").order("contributor_id"), "read voice rights"),
    all(() => db.from("voice_training_sessions").select("id, voice_profile_id").is("recording_deleted_at", null).not("voice_profile_id", "is", null).order("id"), "read recordings"),
  ]);
  const voiceOfLibrary = new Map(libs.map((l) => [l.key as string, l.voice_id as string]));
  const busy = new Set(jobs.map((j) => voiceOfLibrary.get(j.library_key as string)).filter(Boolean));
  const devRights = new Set(rights.filter((r) => r.readli_development_rights).map((r) => r.contributor_id as string));
  const recorded = new Set(sessions.map((s) => s.voice_profile_id as string));
  const snap: LifecycleSnapshot = {
    now: now.toISOString(),
    entitlements: ents.map((e) => ({
      householdId: e.household_id as string,
      source: e.source as string,
      status: e.status as string,
      tier: (e.tier as "family" | "archive" | null) ?? "family",
      startsAt: e.starts_at as string,
      endsAt: (e.ends_at as string | null) ?? null,
      updatedAt: e.updated_at as string,
    })),
    recoveries: recs.map((r) => ({
      householdId: r.household_id as string,
      accessEndedAt: r.access_ended_at as string,
      deletionDueAt: r.deletion_due_at as string,
      status: r.status as "recovering" | "restored" | "held" | "deleted",
      notices: (r.notices as Record<string, string>) ?? {},
    })),
    shares: shares.map((s) => ({ voiceId: s.voice_id as string, householdId: s.household_id as string })),
    libraries: libs.map((l) => ({ key: l.key as string, voiceId: l.voice_id as string, scope: l.scope as string })),
    voices: voices.map((v) => ({
      id: v.id as string,
      status: v.status as string,
      hasClone: Boolean(v.provider_voice_id_encrypted),
      unlinkedSince: (v.unlinked_since as string | null) ?? null,
      ownerId: (v.owner_id as string | null) ?? null,
      pendingJobs: busy.has(v.id as string),
      developmentRights: typeof v.owner_id === "string" && devRights.has(v.owner_id),
      hasRecordings: recorded.has(v.id as string),
    })),
    memberships: members.map((m) => ({ userId: m.user_id as string, householdId: m.household_id as string })),
    billingLive: [],
    billingUnknown: [],
  };
  // The billing check only matters for households whose deletion date has come.
  const due = snap.recoveries.filter((r) => r.status === "recovering" && new Date(r.deletionDueAt) <= now).map((r) => r.householdId);
  await checkBilling(deps, snap, due);
  return snap;
}

async function checkBilling(deps: LifecycleDeps, snap: LifecycleSnapshot, householdIds: string[]): Promise<void> {
  if (!householdIds.length) return;
  const customers = await allIn(deps.db, "billing_customers", "household_id, customer_ref", "household_id", householdIds, "read billing customers");
  for (const c of customers) {
    const householdId = c.household_id as string;
    if (!deps.subscriptionStatuses) {
      // Payments are off, so we can't confirm the subscription really ended: don't delete.
      snap.billingUnknown.push(householdId);
      continue;
    }
    try {
      const statuses = await deps.subscriptionStatuses(c.customer_ref as string);
      if (statuses.some((s) => LIVE_STATUSES.has(s))) snap.billingLive.push(householdId);
    } catch {
      snap.billingUnknown.push(householdId);
    }
  }
}

/** Re-reads one household just before deleting: still no plan, still recovering, still due. */
async function stillDue(db: SupabaseClient, householdId: string, now: Date): Promise<boolean> {
  const [ents, rec] = await Promise.all([
    rows(db.from("household_entitlements").select("status, starts_at, ends_at").eq("household_id", householdId), "re-check plan"),
    rows(db.from("household_recovery").select("status, deletion_due_at").eq("household_id", householdId), "re-check recovery"),
  ]);
  const live = ents.some((e) => e.status === "active" && new Date(e.starts_at as string) <= now && (!e.ends_at || new Date(e.ends_at as string) > now));
  const r = rec[0];
  return !live && r !== undefined && r.status === "recovering" && new Date(r.deletion_due_at as string) <= now;
}

async function guardians(db: SupabaseClient, householdId: string): Promise<string[]> {
  const members = await rows(
    db.from("household_members").select("user_id").eq("household_id", householdId).eq("role", "guardian").is("removed_at", null),
    "read guardians",
  );
  return members.map((m) => m.user_id as string);
}

async function setNotices(db: SupabaseClient, householdId: string, update: Record<string, string>, extra: Row = {}): Promise<void> {
  const current = await rows(db.from("household_recovery").select("notices").eq("household_id", householdId), "read notices");
  const notices = { ...((current[0]?.notices as Record<string, string>) ?? {}), ...update };
  await run(db.from("household_recovery").update({ notices, ...extra }).eq("household_id", householdId), "record notice");
}

export async function runLifecycle(deps: LifecycleDeps): Promise<LifecycleReport> {
  const config = deps.config ?? DEFAULT_LIFECYCLE;
  const now = (deps.now ?? (() => new Date()))();
  const { db } = deps;
  const plan = deps.plan ?? (await effectivePlan(db));
  const runId = randomUUID();
  const report: LifecycleReport = {
    runId,
    dryRunDeletion: !deps.deletion,
    dryRunCloneRetirement: !deps.cloneRetirement,
    dryRunRecordingDeletion: !deps.recordingDeletion,
    counts: {},
    brake: null,
    errors: [],
  };
  // A run that died without finishing stops blocking after two hours.
  await run(
    db.from("lifecycle_runs").update({ status: "abandoned", finished_at: now.toISOString() }).eq("status", "running").lt("started_at", new Date(now.getTime() - 2 * 3_600_000).toISOString()),
    "clear stale runs",
  );
  const lock = await db
    .from("lifecycle_runs")
    .insert({ id: runId, started_at: now.toISOString(), status: "running", deletion_enabled: deps.deletion, clone_retirement_enabled: deps.cloneRetirement });
  if (lock.error) {
    if (lock.error.message.includes("duplicate") || lock.error.message.includes("unique")) return { ...report, skipped: "already_running" };
    throw new Error(`start run: ${lock.error.message}`);
  }
  const count = (k: string): void => {
    report.counts[k] = (report.counts[k] ?? 0) + 1;
  };
  const audit: AuditEntry[] = [];
  const log = (action: string, a: { householdId?: string; voiceId?: string; dryRun?: boolean; detail?: Record<string, unknown> }): void => {
    audit.push({ actor: ACTOR, action, runId, householdId: a.householdId ?? null, voiceId: a.voiceId ?? null, dryRun: a.dryRun ?? false, detail: a.detail ?? {} });
  };

  const names = new Map<string, string>();
  const familyName = async (householdId: string) => {
    if (!names.has(householdId)) {
      const h = await rows(db.from("households").select("name").eq("id", householdId), "read family");
      names.set(householdId, (h[0]?.name as string) || "there");
    }
    return names.get(householdId)!;
  };

  try {
    await steps();
  } catch (err) {
    report.errors.push(`run: ${err instanceof Error ? err.message : String(err)}`);
  }
  await writeAudit(db, audit).catch((err) => report.errors.push(`audit: ${err instanceof Error ? err.message : String(err)}`));
  await db
    .from("lifecycle_runs")
    .update({ status: report.errors.some((e) => e.startsWith("run:")) ? "failed" : "succeeded", finished_at: new Date().toISOString(), counts: report.counts, errors: report.errors.slice(0, 100) })
    .eq("id", runId);
  return report;

  async function steps(): Promise<void> {
    const snap = await loadSnapshot(deps, now);
    const result = planLifecycleRun(snap, { ...config, recoveryDays: plan.recoveryDays, cloneRetireAfterDays: plan.cloneRetireAfterDays });
    report.brake = result.brake;
    if (result.brake) log("safeguard_stopped", { detail: { reason: "mass_deletion_brake", ...result.brake } });

    for (const action of result.actions) {
      try {
        await carryOut(action);
      } catch (err) {
        report.errors.push(`${action.kind}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await recordingDeletions();
    if (deps.sendEmails) {
      try {
        const sent = await deps.sendEmails();
        if (sent) {
          report.counts.emails_sent = sent.sent;
          report.counts.emails_failed = sent.failed;
          report.counts.emails_suppressed = sent.suppressed;
        }
      } catch (err) {
        report.errors.push(`email: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /** Carries out (or, while switched off, dry-runs) pending recording deletion requests. */
  async function recordingDeletions(): Promise<void> {
    const at = now.toISOString();
    for (const r of await pendingRecordingDeletions(db)) {
      const id = r.id as string;
      const detail = { request: id, reason: r.reason, due_at: r.due_at };
      try {
        if (!deps.recordingDeletion) {
          log("recordings_deleted", { voiceId: (r.voice_id as string | null) ?? undefined, dryRun: true, detail });
          count("recording_deletion_dry_run");
          if (new Date(r.due_at as string) <= now) {
            await openException(db, { kind: "recording_deletion_overdue", reason: "Recording deletion is past its 30-day target while deletion is switched off", voiceId: (r.voice_id as string | null) ?? null, detail });
          }
          continue;
        }
        const out = await carryOutRecordingDeletion(db, { id, owner_id: (r.owner_id as string | null) ?? null, voice_id: (r.voice_id as string | null) ?? null }, at);
        log("recordings_deleted", { voiceId: (r.voice_id as string | null) ?? undefined, detail: { ...detail, files: out.files, sessions: out.sessions } });
        count("recordings_deleted");
        if (r.reason === "owner_request" && typeof r.owner_id === "string") {
          const profile = await rows(db.from("adult_profiles").select("display_name").eq("user_id", r.owner_id), "read name");
          const email = recordingsDeletedEmail({ name: (profile[0]?.display_name as string) || "there", deletedAt: at, files: out.files });
          await queueEmails(db, [{ dedupeKey: `recordings_deleted:${id}`, template: "recordings_deleted", ...email, to: { userId: r.owner_id } }]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const attempts = ((r.attempts as number) ?? 0) + 1;
        const blocked = attempts >= 3;
        await db.from("voice_recording_deletions").update({ attempts, last_error: message.slice(0, 300), ...(blocked ? { status: "blocked" } : {}) }).eq("id", id);
        if (blocked) await openException(db, { kind: "recording_deletion_blocked", reason: message.slice(0, 300), voiceId: (r.voice_id as string | null) ?? null, detail });
        report.errors.push(`recording_deletion: ${message}`);
      }
    }
  }

  async function carryOut(action: LifecycleAction): Promise<void> {
    const at = now.toISOString();
    switch (action.kind) {
      case "start_recovery": {
        await run(
          db.from("household_recovery").upsert(
            {
              household_id: action.householdId,
              access_ended_at: action.accessEndedAt,
              deletion_due_at: action.deletionDueAt,
              status: "recovering",
              notices: {},
              hold_reason: null,
              restored_at: null,
              restored_tier: null,
              deleted_at: null,
              started_at: at,
            },
            { onConflict: "household_id" },
          ),
          "open recovery window",
        );
        const stopped = await run(db.rpc("stop_household_narration", { p_household: action.householdId }), "stop narration");
        log("recovery_started", { householdId: action.householdId, detail: { access_ended_at: action.accessEndedAt, deletion_due_at: action.deletionDueAt, stopped_jobs: stopped } });
        return count("recovery_started");
      }
      case "restore": {
        await run(
          db.from("household_recovery").update({ status: "restored", restored_at: at, restored_tier: action.tier, hold_reason: null }).eq("household_id", action.householdId),
          "restore family",
        );
        log("recovery_restored", { householdId: action.householdId, detail: { tier: action.tier } });
        return count("recovery_restored");
      }
      case "notice": {
        const recipients = await guardians(db, action.householdId);
        const daysLeft = Math.max(0, Math.round((new Date(action.deletionDueAt).getTime() - now.getTime()) / 86_400_000));
        const email = recoveryEmail(action.notice, {
          familyName: await familyName(action.householdId),
          endedAt: action.accessEndedAt,
          deletesAt: action.deletionDueAt,
          familyMonthlyPriceCents: plan.familyMonthlyPriceCents,
          archiveMonthlyPriceCents: plan.archiveMonthlyPriceCents,
          billingUrl: deps.billingUrl,
          daysLeft,
        });
        await queueEmails(
          db,
          recipients.map((user) => ({
            dedupeKey: `recovery:${action.householdId}:${action.accessEndedAt}:${action.notice}:${user}`,
            template: `recovery_${action.notice}` as const,
            ...email,
            to: { userId: user },
            householdId: action.householdId,
            sendAfter: at,
            data: { deletion_due_at: action.deletionDueAt, days_left: daysLeft },
          })),
        );
        const update: Record<string, string> = { [action.notice]: at };
        for (const s of action.skipped) update[s] = "skipped";
        await setNotices(db, action.householdId, update, action.moved ? { deletion_due_at: action.deletionDueAt } : {});
        log("recovery_notice", {
          householdId: action.householdId,
          detail: { notice: action.notice, skipped: action.skipped, recipients: recipients.length, deletion_due_at: action.deletionDueAt, moved: Boolean(action.moved) },
        });
        return count(`notice_${action.notice}`);
      }
      case "hold": {
        await run(db.from("household_recovery").update({ status: "held", hold_reason: action.reason }).eq("household_id", action.householdId), "hold deletion");
        log("recovery_held", { householdId: action.householdId, detail: { reason: action.reason } });
        return count("recovery_held");
      }
      case "defer": {
        log("safeguard_stopped", { householdId: action.householdId, detail: { reason: action.reason } });
        return count(`deferred_${action.reason}`);
      }
      case "clean_household": {
        const detail: Record<string, unknown> = { libraries: action.libraryKeys.length, kept_shared: action.keptShared, recording_voices: action.recordingVoices.length };
        if (!deps.deletion) {
          log("household_cleaned", { householdId: action.householdId, dryRun: true, detail });
          return count("cleanup_dry_run");
        }
        if (!(await stillDue(db, action.householdId, now))) {
          log("safeguard_stopped", { householdId: action.householdId, detail: { reason: "changed_before_delete" } });
          return count("deferred_changed_before_delete");
        }
        const recipients = await guardians(db, action.householdId);
        const name = await familyName(action.householdId);
        const result = await cleanHousehold(db, action.householdId, action.libraryKeys, at);
        const owners = await allIn(db, "voice_profiles", "id, owner_id", "id", action.recordingVoices, "read voice owners");
        for (const v of owners) {
          if (typeof v.owner_id !== "string") continue;
          await requestRecordingDeletion(db, { ownerId: v.owner_id, voiceId: v.id as string, reason: "household_cleanup", at: now, detail: { household_id: action.householdId } });
        }
        // Purchased credits are reconciled, never forfeited (Kevin, 2026-10-12, decision 1): the queue gets
        // each pack's unused share of what was actually paid, and the lots and ledger stay on record.
        const owed = reconciliation(await purchasedPacks(db, action.householdId));
        const balance = owed.credits;
        if (balance > 0) {
          await openException(db, {
            kind: "purchased_credits_unreconciled",
            householdId: action.householdId,
            reason: `${balance} purchased credits (unused value $${(owed.unusedValueCents / 100).toFixed(2)}) remain after the recovery window; reconcile any refund owed, never forfeit them automatically`,
            detail: { credits: balance, unused_value_cents: owed.unusedValueCents, packs: owed.packs },
          });
        }
        await run(db.from("household_recovery").update({ status: "deleted", deleted_at: at }).eq("household_id", action.householdId), "mark cleaned");
        const email = deletedEmail({ familyName: name, deletedAt: at, billingUrl: deps.billingUrl });
        await queueEmails(
          db,
          recipients.map((user) => ({ dedupeKey: `household_deleted:${action.householdId}:${at.slice(0, 10)}:${user}`, template: "household_deleted" as const, ...email, to: { userId: user }, householdId: action.householdId })),
        );
        log("household_cleaned", { householdId: action.householdId, detail: { ...detail, audio_files: result.audioFiles, kids: result.kids, purchased_credits_kept: balance } });
        return count("household_cleaned");
      }
      case "unlink_voice":
      case "relink_voice": {
        const unlink = action.kind === "unlink_voice";
        await run(db.from("voice_profiles").update({ unlinked_since: unlink ? at : null }).eq("id", action.voiceId), "mark voice link");
        log(unlink ? "voice_unlinked" : "voice_relinked", { voiceId: action.voiceId });
        return count(action.kind);
      }
      case "retire_clone": {
        if (!deps.cloneRetirement || !deps.retireClone) {
          log("clone_retired", { voiceId: action.voiceId, dryRun: true, detail: { unlinked_since: action.unlinkedSince } });
          return count("clone_retirement_dry_run");
        }
        const retired = await deps.retireClone(action.voiceId);
        if (retired) log("clone_retired", { voiceId: action.voiceId, detail: { unlinked_since: action.unlinkedSince, reason: "unlinked" } });
        return count(retired ? "clone_retired" : "clone_retirement_skipped");
      }
    }
  }
}

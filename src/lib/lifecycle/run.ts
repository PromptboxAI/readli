import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { keysOf, NARRATION_BUCKETS, removeObjects } from "@/lib/account/privacy";
import { effectivePlan } from "@/lib/billing/price-settings";
import type { PlanConfig } from "@/lib/family/plan";
import { all, allIn, rows, run, writeAudit, type AuditEntry, type Row } from "./db";
import { recoveryEmail, type RecoveryNotice } from "./notices";
import { DEFAULT_LIFECYCLE, planLifecycleRun, type LifecycleAction, type LifecycleConfig, type LifecycleSnapshot } from "./plan";

/**
 * Carries out the daily lifecycle plan against Supabase. Non-destructive steps (opening a recovery
 * window, queueing reminder emails, restoring a household that came back, marking voices unlinked)
 * always run. Destructive steps run only when switched on (LIFECYCLE_DELETION=on for Day-30 deletion,
 * LIFECYCLE_CLONE_RETIREMENT=on for retiring unused clones); otherwise they are logged as dry runs.
 * Every step, real or dry, goes to the lifecycle audit log under one run id.
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
  config?: LifecycleConfig;
  plan?: PlanConfig;
  now?: () => Date;
}

export interface LifecycleReport {
  runId: string;
  dryRunDeletion: boolean;
  dryRunCloneRetirement: boolean;
  counts: Record<string, number>;
  brake: { wouldDelete: number; households: number } | null;
  errors: string[];
}

export function lifecycleFlags(env: NodeJS.ProcessEnv = process.env): { deletion: boolean; cloneRetirement: boolean } {
  return { deletion: env.LIFECYCLE_DELETION === "on", cloneRetirement: env.LIFECYCLE_CLONE_RETIREMENT === "on" };
}

async function loadSnapshot(deps: LifecycleDeps, now: Date): Promise<LifecycleSnapshot> {
  const { db } = deps;
  const [ents, recs, shares, libs, voices] = await Promise.all([
    all(() => db.from("household_entitlements").select("household_id, source, status, tier, starts_at, ends_at, updated_at").order("id"), "read plans"),
    all(() => db.from("household_recovery").select("household_id, access_ended_at, deletion_due_at, status, notices").order("household_id"), "read recovery"),
    all(() => db.from("voice_household_shares").select("voice_id, household_id").is("revoked_at", null).order("id"), "read sharing"),
    all(() => db.from("narration_libraries").select("key, voice_id, scope").order("key"), "read narration"),
    all(() => db.from("voice_profiles").select("id, status, provider_voice_id_encrypted, unlinked_since").in("status", ["processing", "ready"]).order("id"), "read voices"),
  ]);
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
    })),
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
    counts: {},
    brake: null,
    errors: [],
  };
  const count = (k: string): void => {
    report.counts[k] = (report.counts[k] ?? 0) + 1;
  };
  const audit: AuditEntry[] = [];
  const log = (action: string, a: { householdId?: string; voiceId?: string; dryRun?: boolean; detail?: Record<string, unknown> }): void => {
    audit.push({ actor: ACTOR, action, runId, householdId: a.householdId ?? null, voiceId: a.voiceId ?? null, dryRun: a.dryRun ?? false, detail: a.detail ?? {} });
  };

  const snap = await loadSnapshot(deps, now);
  const result = planLifecycleRun(snap, { ...config, recoveryDays: plan.recoveryDays, cloneRetireAfterDays: plan.cloneRetireAfterDays });
  report.brake = result.brake;
  if (result.brake) log("safeguard_stopped", { detail: { reason: "mass_deletion_brake", ...result.brake } });

  const names = new Map<string, string>();
  const familyName = async (householdId: string) => {
    if (!names.has(householdId)) {
      const h = await rows(db.from("households").select("name").eq("id", householdId), "read family");
      names.set(householdId, (h[0]?.name as string) || "there");
    }
    return names.get(householdId)!;
  };

  for (const action of result.actions) {
    try {
      await carryOut(action);
    } catch (err) {
      report.errors.push(`${action.kind}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  await writeAudit(db, audit).catch((err) => report.errors.push(`audit: ${err instanceof Error ? err.message : String(err)}`));
  return report;

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
        if (recipients.length) {
          await run(
            db.from("email_outbox").upsert(
              recipients.map((user) => ({
                dedupe_key: `recovery:${action.householdId}:${action.accessEndedAt}:${action.notice}:${user}`,
                household_id: action.householdId,
                recipient_user_id: user,
                template: `recovery_${action.notice}`,
                subject: email.subject,
                body: email.body,
                send_after: at,
              })),
              { onConflict: "dedupe_key", ignoreDuplicates: true },
            ),
            "queue email",
          );
        }
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
      case "delete_household_narration": {
        const detail: Record<string, unknown> = { libraries: action.libraryKeys.length, kept_shared: action.keptShared };
        if (!deps.deletion) {
          log("recovery_deleted", { householdId: action.householdId, dryRun: true, detail });
          return count("deletion_dry_run");
        }
        if (!(await stillDue(db, action.householdId, now))) {
          log("safeguard_stopped", { householdId: action.householdId, detail: { reason: "changed_before_delete" } });
          return count("deferred_changed_before_delete");
        }
        const segments = await allIn(db, "narration_segments", "storage_key", "library_key", action.libraryKeys, "read narration");
        const children = await rows(db.from("child_profiles").select("id").eq("household_id", action.householdId), "read kids");
        const childIds = children.map((c) => c.id as string);
        const assets = childIds.length ? await allIn(db, "narration_assets", "storage_key", "child_id", childIds, "read older narration") : [];
        const removed = (await removeObjects(db, NARRATION_BUCKETS.segments, keysOf(segments))) + (await removeObjects(db, NARRATION_BUCKETS.assets, keysOf(assets)));
        for (let i = 0; i < action.libraryKeys.length; i += 200) {
          await run(db.from("narration_segments").delete().in("library_key", action.libraryKeys.slice(i, i + 200)), "delete narration");
        }
        for (let i = 0; i < childIds.length; i += 200) {
          await run(db.from("narration_assets").delete().in("child_id", childIds.slice(i, i + 200)), "delete older narration");
        }
        await run(db.from("household_recovery").update({ status: "deleted", deleted_at: at }).eq("household_id", action.householdId), "mark deleted");
        log("recovery_deleted", { householdId: action.householdId, detail: { ...detail, audio_files: removed } });
        return count("recovery_deleted");
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

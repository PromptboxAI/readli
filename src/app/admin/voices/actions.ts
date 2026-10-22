"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { accountDb } from "@/lib/family/account-store";
import { rows, writeAudit } from "@/lib/lifecycle/db";
import { CONFIRM_REMOVAL, removeInSupabase, RemovalError, type RemovalPlan, type RemovalRequest } from "@/lib/lifecycle/legal-removal";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";

function summary(plan: RemovalPlan): string {
  const what = plan.wholeVoice ? "the whole voice" : `the book ${plan.target.bookSlug}`;
  return `${plan.libraryKeys.length} narration libraries (${plan.segments} sentences of audio) for ${what}, ${plan.jobIds.length} unfinished jobs, ${plan.households.length} families affected${plan.wholeVoice ? `, ${plan.recordings} original recordings` : ""}`;
}

/**
 * Legally required removal from /admin/voices. Without the confirmation word it is a dry run that
 * logs what would go. The real run needs the confirmation word and a dry run of the same target by
 * the same admin in the last day.
 */
export async function legalRemovalAction(form: FormData) {
  const gate = await requireAdmin("/admin/voices");
  const db = accountDb();
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  let outcome: string;
  if (gate.preview || !db) {
    outcome = `err=${encodeURIComponent("Legal removal works once sign-in and Supabase are connected.")}`;
  } else {
    const req: RemovalRequest = {
      voiceId: get("voice_id"),
      bookSlug: get("book_slug") || null,
      reason: get("reason"),
      reference: get("reference"),
      requestedBy: gate.admin.email,
      includeRecordings: form.get("keep_recordings") !== "on",
    };
    const confirmed = get("confirm") === CONFIRM_REMOVAL;
    try {
      if (confirmed) {
        const since = new Date(Date.now() - 86_400_000).toISOString();
        const previews = await rows(
          db.from("lifecycle_audit_log").select("detail").eq("action", "legal_removal").eq("dry_run", true).eq("voice_id", req.voiceId).eq("actor", req.requestedBy).gte("at", since),
          "read dry runs",
        );
        const matched = previews.some((p) => ((p.detail as Record<string, unknown>)?.book ?? null) === (req.bookSlug ?? null));
        if (!matched) throw new RemovalError("Run a dry run of this exact removal first, then confirm it.");
      }
      const deps = accountVoiceDeps(serverConfig());
      const plan = await removeInSupabase(db, req, {
        dryRun: !confirmed,
        deleteClone: deps
          ? async (voiceId) => {
              const id = await deps.store.providerVoiceId(voiceId);
              if (id) await deps.provider.deleteVoice(id);
            }
          : undefined,
      });
      outcome = `ok=${encodeURIComponent(`${confirmed ? "Removed" : `Dry run, nothing changed. Would remove`} ${summary(plan)}.${confirmed ? "" : ` Type ${CONFIRM_REMOVAL} to carry it out.`}`)}`;
    } catch (err) {
      outcome = `err=${encodeURIComponent(err instanceof RemovalError ? err.message : `Removal failed: ${err instanceof Error ? err.message : String(err)}`)}`;
    }
  }
  redirect(`/admin/voices?${outcome}#legal-removal`);
}

/** Resolves an item in the lifecycle exception queue, with what was done, in the audit log. */
export async function resolveExceptionAction(form: FormData) {
  const gate = await requireAdmin("/admin/voices");
  const db = accountDb();
  const id = typeof form.get("id") === "string" ? (form.get("id") as string) : "";
  const resolution = typeof form.get("resolution") === "string" ? (form.get("resolution") as string).trim().slice(0, 500) : "";
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("The exception queue works once sign-in and Supabase are connected.")}`;
  else if (!id || resolution.length < 5) outcome = `err=${encodeURIComponent("Say what was done before resolving it.")}`;
  else {
    const at = new Date().toISOString();
    const [done] = await rows(
      db.from("lifecycle_exceptions").update({ status: "resolved", resolved_at: at, resolved_by: gate.admin.id, resolution }).eq("id", id).eq("status", "open").select("id, kind, household_id, voice_id"),
      "resolve exception",
    );
    if (done) {
      await writeAudit(db, [
        { actor: gate.admin.email, action: "exception_resolved", householdId: (done.household_id as string | null) ?? null, voiceId: (done.voice_id as string | null) ?? null, detail: { kind: done.kind, resolution } },
      ]);
      outcome = `ok=${encodeURIComponent("Resolved.")}`;
    } else outcome = `err=${encodeURIComponent("That item was already resolved.")}`;
  }
  redirect(`/admin/voices?${outcome}#exceptions`);
}

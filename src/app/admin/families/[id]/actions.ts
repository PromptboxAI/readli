"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireAdmin, type AdminUser } from "@/lib/admin/access";
import { logSupportAction, supportFamily, type SupportFamily } from "@/lib/admin/family-support";
import { accountDb } from "@/lib/family/account-store";
import { AccountNarrationProvider } from "@/lib/narration/account-provider";
import { displayCredits } from "@/lib/narration/credits";
import { runPendingJobs } from "@/lib/narration/narration";
import { SupportError, supportCarryForward, supportPrepare, supportRefund, supportStop } from "@/lib/narration/support";
import { serverConfig } from "@/lib/server/config";
import { accountVoiceDeps } from "@/lib/voice/account-voices";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A worker gets this long after the response, like the family's own book page; the next visit or Resume picks up the rest. */
const WORK_BUDGET_MS = 270_000;

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
};

const ID = /^[0-9a-f-]{36}$/i;

function provider() {
  const deps = accountVoiceDeps(serverConfig());
  return deps ? new AccountNarrationProvider(deps) : null;
}

/** Keeps preparing this family's queued work after the response, as the family's own book page does. */
function work(family: SupportFamily, householdId: string): boolean {
  const voices = provider();
  if (!voices) return false;
  after(() => runPendingJobs(family.store, voices, { householdId, budgetMs: WORK_BUDGET_MS }));
  return true;
}

/**
 * Runs one support fix for one family after re-checking who is asking, then returns to the family's
 * page (at the book it was about) with what happened.
 */
async function forFamily(form: FormData, run: (ctx: { db: SupabaseClient; admin: AdminUser; family: SupportFamily; householdId: string }) => Promise<string>) {
  const householdId = field(form, "householdId");
  const anchor = field(form, "book").replace(/[^a-z0-9-]/g, "");
  const path = `/admin/families/${ID.test(householdId) ? householdId : ""}`;
  const gate = await requireAdmin(path);
  const db = accountDb();
  let outcome: string;
  if (gate.preview || !db) outcome = `err=${encodeURIComponent("Support fixes need sign-in and Supabase connected.")}`;
  else if (!ID.test(householdId)) outcome = `err=${encodeURIComponent("That family wasn't found.")}`;
  else {
    try {
      const family = await supportFamily(db, householdId);
      if (!family) throw new SupportError("That family no longer exists, or has no grown-up left in it.");
      outcome = `ok=${encodeURIComponent(await run({ db, admin: gate.admin, family, householdId }))}`;
    } catch (err) {
      if (!(err instanceof SupportError)) console.error("[admin] support fix failed", err);
      outcome = `err=${encodeURIComponent(err instanceof Error ? err.message : String(err))}`;
    }
  }
  redirect(`${path}?${outcome}${anchor ? `#book-${anchor}` : ""}`);
}

/** Today's text takes every sentence the voice already said the same way. Free, nothing generated. */
export async function carryForwardAction(form: FormData) {
  await forFamily(form, async ({ db, admin, family, householdId }) => {
    const voiceId = field(form, "voiceId");
    const book = field(form, "book");
    const n = await supportCarryForward(family.store, householdId, voiceId, book);
    await logSupportAction(db, admin, "narration_carried_forward", householdId, { voiceId, book, sentences: n });
    return `Carried ${n} prepared ${n === 1 ? "sentence" : "sentences"} over to today's text. Nothing was charged.`;
  });
}

/** Prepares a book, or one chapter, in today's text at Readli's cost. */
export async function prepareFreeAction(form: FormData) {
  await forFamily(form, async ({ db, admin, family, householdId }) => {
    const voiceId = field(form, "voiceId");
    const book = field(form, "book");
    const raw = field(form, "chapter");
    const chapter = raw ? Number.parseInt(raw, 10) : null;
    if (chapter !== null && !Number.isInteger(chapter)) throw new SupportError("Choose a chapter.");
    if (!provider()) throw new SupportError("Narration isn't switched on here, so nothing can be prepared.");
    const job = await supportPrepare(family.store, admin.id, householdId, { voiceId, bookSlug: book, chapter });
    if (!job) return "Nothing left to prepare there: it's ready or already preparing. Any audio this voice already had came over.";
    await logSupportAction(db, admin, "narration_prepared_free", householdId, { voiceId, book, chapter, jobId: job.id, sentences: job.sentenceIds.length });
    work(family, householdId);
    return `Preparing ${job.sentenceIds.length} ${job.sentenceIds.length === 1 ? "sentence" : "sentences"}${chapter ? ` (chapter ${chapter})` : ""} at Readli's cost. It shows on the family's book page as it goes.`;
  });
}

/** Stops a preparation; unused credits go back to the family. */
export async function stopPreparationAction(form: FormData) {
  await forFamily(form, async ({ db, admin, family, householdId }) => {
    const jobId = field(form, "jobId");
    await supportStop(family.store, householdId, jobId);
    await logSupportAction(db, admin, "narration_stopped", householdId, { jobId });
    return "Stopped that preparation. Anything it finished stays, and unused credits went back to the family.";
  });
}

/** Starts a stalled preparation working again, from where it stopped. */
export async function resumePreparationAction(form: FormData) {
  await forFamily(form, async ({ db, admin, family, householdId }) => {
    const jobId = field(form, "jobId");
    const state = await family.store.read();
    const job = state.jobs.find((j) => j.id === jobId && j.householdId === householdId);
    if (!job || (job.status !== "queued" && job.status !== "running")) throw new SupportError("That preparation has already stopped. Prepare what's missing instead.");
    if (!work(family, householdId)) throw new SupportError("Narration isn't switched on here, so nothing can be prepared.");
    await logSupportAction(db, admin, "narration_resumed", householdId, { jobId });
    return "Started that preparation again from where it stopped. Refresh in a minute to see it move.";
  });
}

/** Gives back what one finished preparation used, as credits that never expire. */
export async function refundPreparationAction(form: FormData) {
  await forFamily(form, async ({ db, admin, family, householdId }) => {
    const jobId = field(form, "jobId");
    const { units, note } = await supportRefund(family.store, householdId, jobId);
    const credits = displayCredits(units, family.plan.charactersPerCredit);
    await logSupportAction(db, admin, "narration_refunded", householdId, { jobId, units, credits });
    return `Refunded ${credits.toLocaleString("en-US")} credits. The family sees "${note}" with them, and keeps the audio.`;
  });
}

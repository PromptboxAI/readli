import { after, NextResponse } from "next/server";
import { jsonBody, withFamily } from "@/lib/family/http";
import { guardianHousehold } from "@/lib/family/service";
import { familyProvider } from "@/lib/family/session";
import { cancelGeneration, prepareView, quoteGeneration, requestGeneration, runPendingJobs, type GenerationRequest } from "@/lib/narration/narration";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";
// Background preparation runs after the response, up to this long; the next request resumes it.
export const maxDuration = 300;
const WORK_BUDGET_MS = 270_000;

type Params = { params: Promise<{ slug: string }> };
const notGuardian = () => fail(403, "not_guardian", "Only a parent or guardian can prepare narration.");

/** Prepare Narration: this family's voices for the book, their audio status, and credits left. */
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  return withFamily(async ({ store, actor, session }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return notGuardian();
    const view = await prepareView(store, actor, householdId, slug);
    // The page polls while preparing; this picks up a job whose worker stopped (one worker per job).
    const provider = familyProvider(session);
    const state = await store.read();
    if (provider && state.jobs.some((j) => j.householdId === householdId && (j.status === "queued" || j.status === "running"))) {
      after(() => runPendingJobs(store, provider, { householdId, budgetMs: WORK_BUDGET_MS }));
    }
    return NextResponse.json(view, { headers: { "cache-control": "no-store" } });
  });
}

/**
 * { voiceId, scope: "book" | "chapter" | "passage", chapter?, sentenceIds?, confirm }. Without
 * confirm it returns the estimate; with confirm it reserves credits and starts the job in the background.
 */
export async function POST(req: Request, { params }: Params) {
  const { slug } = await params;
  const body = await jsonBody(req);
  const scope = body.scope ?? "book";
  if (typeof body.voiceId !== "string" || (scope !== "book" && scope !== "chapter" && scope !== "passage")) {
    return fail(400, "bad_request", "Choose a storyteller.");
  }
  const request: GenerationRequest = {
    voiceId: body.voiceId,
    bookSlug: slug,
    scope,
    chapter: typeof body.chapter === "number" ? body.chapter : undefined,
    sentenceIds: Array.isArray(body.sentenceIds) ? body.sentenceIds.filter((x): x is string => typeof x === "string").slice(0, 500) : undefined,
  };
  return withFamily(async ({ store, actor, session }) => {
    const householdId = await guardianHousehold(store, actor);
    if (!householdId) return notGuardian();
    if (body.confirm !== true) return NextResponse.json({ quote: await quoteGeneration(store, actor, householdId, request) });
    const provider = familyProvider(session);
    if (!provider) return fail(503, "narration_off", "Preparing stories isn't switched on yet.");
    const result = await requestGeneration(store, actor, householdId, request);
    // Background generation; the job is resumable if the worker stops partway.
    if (result.job) after(() => runPendingJobs(store, provider, { householdId, budgetMs: WORK_BUDGET_MS }));
    return NextResponse.json({ jobId: result.job?.id ?? null, quote: result.quote, view: await prepareView(store, actor, householdId, slug) });
  });
}

/** Cancel pending work: ?jobId=... Unused credits are refunded. */
export async function DELETE(req: Request, { params }: Params) {
  const { slug } = await params;
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return fail(400, "bad_request", "Which preparation?");
  return withFamily(async ({ store, actor }) => {
    await cancelGeneration(store, actor, jobId);
    const householdId = (await guardianHousehold(store, actor))!;
    return NextResponse.json(await prepareView(store, actor, householdId, slug));
  });
}

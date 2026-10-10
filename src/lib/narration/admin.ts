import type { FamilyState } from "@/lib/family/model";
import type { PlanConfig } from "@/lib/family/plan";
import { ELEVENLABS_PLANS, modelCost, usdPerMinute } from "./costs";
import { creditBalance, libraryStatus, READINESS_LABELS } from "./narration";
import type { NarrationStorage } from "./storage";
import { bookText } from "./text";

/** Admin narration dashboard figures (Narration Libraries amendment §9). */
export async function narrationMetrics(state: FamilyState, plan: PlanConfig, storage: NarrationStorage, at = new Date().toISOString()) {
  const ready = state.segments.filter((s) => s.status === "ready" && s.storageKey);
  const charsOf = new Map(state.segments.map((s) => [`${s.libraryKey}|${s.sentenceId}`, s.characters]));
  const providerCredits = state.usage.reduce((n, u) => n + u.providerCredits, 0);
  const charactersGenerated = state.usage.reduce((n, u) => n + u.characters, 0);
  const pro = ELEVENLABS_PLANS[0]!;
  const usdPerCredit = pro.monthlyUsd / pro.credits;

  const libraries = state.libraries.map((l) => {
    const text = bookText(l.bookSlug);
    const status = text ? libraryStatus(state, l, text) : null;
    const owner = state.adults.find((a) => a.id === state.voices.find((v) => v.id === l.voiceId)?.ownerId);
    const households = new Set([...state.plays.filter((p) => p.libraryKey === l.key).map((p) => p.householdId), ...state.jobs.filter((j) => j.libraryKey === l.key).map((j) => j.householdId)]);
    return {
      key: l.key,
      book: text?.title ?? l.bookSlug,
      voice: owner?.displayName ?? l.voiceId,
      readiness: status ? READINESS_LABELS[status.readiness] : "Text changed",
      ready: status?.ready ?? 0,
      total: status?.total ?? 0,
      households: households.size,
      scope: l.scope === "shared" ? "Shared" : "One household",
    };
  });

  // Every listen beyond a segment's first, and every extra household on a shared library, is
  // generation that didn't have to happen.
  const playsBySegment = new Map<string, number>();
  for (const p of state.plays) playsBySegment.set(`${p.libraryKey}|${p.sentenceId}`, (playsBySegment.get(`${p.libraryKey}|${p.sentenceId}`) ?? 0) + 1);
  let replayCharactersAvoided = 0;
  for (const [k, n] of playsBySegment) replayCharactersAvoided += Math.max(0, n - 1) * (charsOf.get(k) ?? 0);
  let sharingCharactersAvoided = 0;
  for (const l of libraries) {
    if (l.households > 1) sharingCharactersAvoided += (l.households - 1) * ready.filter((s) => s.libraryKey === l.key).reduce((n, s) => n + s.characters, 0);
  }
  const unused = ready.filter((s) => !playsBySegment.has(`${s.libraryKey}|${s.sentenceId}`));

  const households = state.households.map((h) => {
    const b = creditBalance(state, plan, h.id, at);
    const entries = state.ledger.filter((e) => e.householdId === h.id && e.period === b.period);
    const sum = (kind: string) => entries.filter((e) => e.kind === kind).reduce((n, e) => n + e.seconds, 0);
    return { name: h.name, allowance: b.allowanceSeconds, used: b.usedThisPeriod, held: b.heldSeconds, refunded: sum("refund"), purchasedLeft: b.purchasedLeft, available: b.available };
  });

  const model = modelCost(plan.narrationModelId);
  return {
    modelId: plan.narrationModelId,
    totals: {
      libraries: state.libraries.length,
      readySegments: ready.length,
      readyMinutes: Math.round(ready.reduce((n, s) => n + (s.durationMs ?? 0), 0) / 600) / 100,
      queuedJobs: state.jobs.filter((j) => j.status === "queued" || j.status === "running").length,
      failedJobs: state.jobs.filter((j) => j.status === "failed").length,
      failedSegments: state.segments.filter((s) => s.status === "failed").length,
      charactersGenerated,
      providerCredits,
      providerUsd: Math.round(providerCredits * usdPerCredit * 100) / 100,
      bytesStored: await storage.bytesStored(),
      listens: state.plays.length,
      providerCalls: state.usage.length,
      cacheHitRate: state.plays.length + state.usage.length ? state.plays.length / (state.plays.length + state.usage.length) : 0,
      replayCharactersAvoided,
      sharingCharactersAvoided,
      unusedSegments: unused.length,
      unusedCharacters: unused.reduce((n, s) => n + s.characters, 0),
    },
    libraries,
    failedJobs: state.jobs.filter((j) => j.status === "failed").map((j) => ({ id: j.id, library: j.libraryKey, sentences: j.sentenceIds.length, at: j.finishedAt })),
    households,
    plans: ELEVENLABS_PLANS.map((p) => ({ ...p, usdPerMinute: usdPerMinute(p, model) })),
    allowanceCostUsd: (plan.monthlyNarrationMinutes * usdPerMinute(pro, model)),
  };
}

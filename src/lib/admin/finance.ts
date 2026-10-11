import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

const DAY = 24 * 60 * 60 * 1000;
const GB = 1024 ** 3;
const WINDOW_DAYS = 30;

/**
 * Cost assumptions for the financial report. They are planning numbers from the pricing pack, not
 * invoice prices. Admins edit them on /admin/finance (finance_settings); FINANCE_* env settings and
 * the defaults below apply until that row exists.
 */
export interface CostConfig {
  /** Provider dollars per 1,000 characters, by model; models not listed use defaultPer1kUsd. */
  per1kUsd: Record<string, number>;
  defaultPer1kUsd: number;
  lowPer1kUsd: number;
  /** The ElevenLabs plan Readli is on. Usage up to its monthly fee is already paid for by its included credits. */
  providerPlanName: string;
  providerPlanMonthlyUsd: number;
  storageUsdPerGbMonth: number;
  deliveryUsdPerGb: number;
}

/** Readli's ElevenLabs account is on the Creator plan. */
export const DEFAULT_PROVIDER_PLAN = { name: "Creator", monthlyUsd: 22 };
const LOW_COST_MODELS = ["eleven_flash_v2_5", "eleven_flash_v2", "eleven_turbo_v2_5", "eleven_turbo_v2"];

const num = (v: unknown, fallback: number) => {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Cost settings from the admin's saved row, else env, else the defaults. */
export function costConfig(env: NodeJS.ProcessEnv = process.env, saved: Row | null = null): CostConfig {
  const low = num(saved?.low_cost_per_1k_chars_usd, num(env.FINANCE_LOW_COST_PER_1K_CHARS_USD, 0.05));
  const name = typeof saved?.provider_plan_name === "string" && saved.provider_plan_name.trim() ? saved.provider_plan_name.trim() : DEFAULT_PROVIDER_PLAN.name;
  return {
    per1kUsd: Object.fromEntries(LOW_COST_MODELS.map((m) => [m, low])),
    defaultPer1kUsd: num(saved?.cost_per_1k_chars_usd, num(env.FINANCE_COST_PER_1K_CHARS_USD, 0.1)),
    lowPer1kUsd: low,
    providerPlanName: name,
    providerPlanMonthlyUsd: num(saved?.provider_plan_monthly_usd, num(env.FINANCE_PROVIDER_PLAN_MONTHLY_USD, DEFAULT_PROVIDER_PLAN.monthlyUsd)),
    storageUsdPerGbMonth: num(saved?.storage_usd_per_gb_month, num(env.FINANCE_STORAGE_USD_PER_GB_MONTH, 0.021)),
    deliveryUsdPerGb: num(saved?.delivery_usd_per_gb, num(env.FINANCE_DELIVERY_USD_PER_GB, 0.09)),
  };
}

/** The admin's saved cost settings, or null before the finance_settings migration runs. */
export async function savedCostSettings(db: SupabaseClient): Promise<Row | null> {
  const { data, error } = await db.from("finance_settings").select("*").eq("id", true).maybeSingle();
  return error ? null : ((data as Row | null) ?? null);
}

export interface FinanceInputs {
  at: Date;
  /** Every household plan row: id, household_id, source, status, extra_narrator_slots, starts_at, ends_at. */
  entitlements: Row[];
  /** revenue_events rows for the chosen mode (live or test). */
  revenue: Row[];
  /** Active household memberships: household_id, user_id. */
  members: Row[];
  /** Every grown-up account id. */
  adultIds: string[];
  /** Ready, undeleted voices: owner_id. */
  voices: Row[];
  /** Provider usage in the last 30 days: library_key, sentence_id, model_id, characters, provider_credits, bytes. */
  usage: Row[];
  /** Narration jobs that could have produced that usage: library_key, household_id, sentence_ids. */
  jobs: Row[];
  /** Narration plays in the last 30 days. */
  plays: number;
  /** Audio bytes stored (all narration ever generated). */
  storedBytes: number;
  costs: CostConfig;
}

export interface HouseholdMargin {
  householdId: string;
  name?: string;
  revenueCents: number;
  costUsd: number;
  marginUsd: number;
}

export interface FinanceReport {
  payingFamilies: number;
  giftFamilies: number;
  trialFamilies: number;
  complimentaryFamilies: number;
  voiceContributors: number;
  verifiedVoices: number;
  slotsPurchased: number;
  subscriptionMrrCents: number;
  slotMrrCents: number;
  subscriptionArrCents: number;
  recurringArrCents: number;
  creditPacks30d: { cents: number; count: number };
  creditPacksAllTime: { cents: number; count: number };
  gifts30d: { cents: number; count: number };
  giftsAllTime: { cents: number; count: number };
  trials: { active: number; ended: number; converted: number; rate: number | null };
  churn: { startingFamilies: number; churned: number; rate: number | null; retention: number | null };
  arpuCents: number | null;
  costs30d: {
    characters: number;
    providerCredits: number;
    generationUsd: number;
    providerExpenseUsd: number;
    storageUsd: number;
    deliveryUsd: number;
    totalUsd: number;
  };
  revenue30dCents: number;
  operatingContributionUsd: number;
  households: HouseholdMargin[];
  hasRevenueData: boolean;
  costs: CostConfig;
}

const ts = (v: unknown) => (typeof v === "string" ? Date.parse(v) : NaN);
const int = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;

/** A plan row covers a moment when it had started and hadn't ended. A canceled row with no end date never counts. */
function covers(e: Row, t: number): boolean {
  if (ts(e.starts_at) > t) return false;
  if (e.ends_at === null || e.ends_at === undefined) return e.status === "active";
  return ts(e.ends_at) > t;
}

function householdsWith(entitlements: Row[], sources: string[], t: number): Set<string> {
  return new Set(entitlements.filter((e) => sources.includes(e.source as string) && covers(e, t)).map((e) => e.household_id as string));
}

/** Monthly value of a recurring revenue line whose paid period covers now; 0 otherwise. */
export function monthlyValueCents(r: Row, t: number): number {
  if (r.kind !== "subscription" && r.kind !== "narrator_slot") return 0;
  if (!(ts(r.period_start) <= t && ts(r.period_end) > t)) return 0;
  const amount = int(r.amount_cents);
  return r.billing_interval === "year" ? amount / 12 : amount;
}

function sum(rows: Row[], kind: string, since: number | null) {
  const list = rows.filter((r) => r.kind === kind && (since === null || ts(r.occurred_at) >= since));
  return { cents: list.reduce((s, r) => s + int(r.amount_cents), 0), count: list.filter((r) => int(r.amount_cents) > 0).length };
}

export function rateFor(costs: CostConfig, modelId: unknown): number {
  return costs.per1kUsd[modelId as string] ?? costs.defaultPer1kUsd;
}

/**
 * Builds the report. Recurring revenue (subscriptions and narrator slots) is MRR; credit packs and
 * gifts are one-time and never counted in it. Refunds are negative revenue rows of the same kind.
 */
export function financeReport(input: FinanceInputs): FinanceReport {
  const now = input.at.getTime();
  const since = now - WINDOW_DAYS * DAY;
  const { entitlements, revenue, costs } = input;

  const paying = householdsWith(entitlements, ["subscription"], now);
  const gifted = householdsWith(entitlements, ["gift"], now);
  const trialing = householdsWith(entitlements, ["trial"], now);
  const comp = householdsWith(entitlements, ["donated", "tester"], now);
  const anyPlan = householdsWith(entitlements, ["subscription", "gift", "trial", "donated", "tester"], now);
  const withPlan = new Set(input.members.filter((m) => anyPlan.has(m.household_id as string)).map((m) => m.user_id as string));
  const slotsPurchased = entitlements
    .filter((e) => e.source === "subscription" && covers(e, now))
    .reduce((s, e) => s + int(e.extra_narrator_slots), 0);

  let subscriptionMrrCents = 0;
  let slotMrrCents = 0;
  for (const r of revenue) {
    const v = monthlyValueCents(r, now);
    if (r.kind === "subscription") subscriptionMrrCents += v;
    else if (r.kind === "narrator_slot") slotMrrCents += v;
  }
  subscriptionMrrCents = Math.round(subscriptionMrrCents);
  slotMrrCents = Math.round(slotMrrCents);

  const trialRows = entitlements.filter((e) => e.source === "trial");
  const endedTrials = trialRows.filter((e) => e.ends_at !== null && ts(e.ends_at) <= now);
  const converted = endedTrials.filter((t) =>
    entitlements.some((e) => e.source === "subscription" && e.household_id === t.household_id && ts(e.starts_at) >= ts(t.starts_at)),
  ).length;

  const payingThen = householdsWith(entitlements, ["subscription"], since);
  const churned = [...payingThen].filter((h) => !paying.has(h)).length;
  const churnRate = payingThen.size ? churned / payingThen.size : null;

  // Generation cost goes to the household whose job made the audio.
  const madeBy = new Map<string, string>();
  for (const j of input.jobs) for (const s of (j.sentence_ids as string[] | null) ?? []) madeBy.set(`${j.library_key}|${s}`, j.household_id as string);
  const costByHousehold = new Map<string, number>();
  let characters = 0;
  let providerCredits = 0;
  let generationUsd = 0;
  let bytes30d = 0;
  for (const u of input.usage) {
    const chars = int(u.characters);
    const usd = (chars / 1000) * rateFor(costs, u.model_id);
    characters += chars;
    providerCredits += int(u.provider_credits);
    generationUsd += usd;
    bytes30d += int(u.bytes);
    const h = madeBy.get(`${u.library_key}|${u.sentence_id}`);
    if (h) costByHousehold.set(h, (costByHousehold.get(h) ?? 0) + usd);
  }
  // Usage up to the plan fee is already paid for by the plan's included credits, so it isn't counted twice.
  const providerExpenseUsd = Math.max(costs.providerPlanMonthlyUsd, generationUsd);
  const storageUsd = (input.storedBytes / GB) * costs.storageUsdPerGbMonth;
  const avgBytes = input.usage.length ? bytes30d / input.usage.length : 0;
  const deliveryUsd = ((input.plays * avgBytes) / GB) * costs.deliveryUsdPerGb;
  const totalUsd = providerExpenseUsd + storageUsd + deliveryUsd;

  const creditPacks30d = sum(revenue, "credit_pack", since);
  const gifts30d = sum(revenue, "gift", since);
  const revenue30dCents = subscriptionMrrCents + slotMrrCents + creditPacks30d.cents + gifts30d.cents;

  const revenueByHousehold = new Map<string, number>();
  for (const r of revenue) {
    const h = r.household_id as string | null;
    if (!h) continue;
    const v = r.kind === "subscription" || r.kind === "narrator_slot" ? monthlyValueCents(r, now) : ts(r.occurred_at) >= since ? int(r.amount_cents) : 0;
    if (v) revenueByHousehold.set(h, (revenueByHousehold.get(h) ?? 0) + v);
  }
  const households = [...new Set([...revenueByHousehold.keys(), ...costByHousehold.keys()])]
    .map((householdId) => {
      const revenueCents = Math.round(revenueByHousehold.get(householdId) ?? 0);
      const costUsd = costByHousehold.get(householdId) ?? 0;
      return { householdId, revenueCents, costUsd, marginUsd: revenueCents / 100 - costUsd };
    })
    .sort((a, b) => a.marginUsd - b.marginUsd);

  return {
    payingFamilies: paying.size,
    giftFamilies: gifted.size,
    trialFamilies: trialing.size,
    complimentaryFamilies: comp.size,
    voiceContributors: input.adultIds.filter((id) => !withPlan.has(id)).length,
    verifiedVoices: input.voices.length,
    slotsPurchased,
    subscriptionMrrCents,
    slotMrrCents,
    subscriptionArrCents: subscriptionMrrCents * 12,
    recurringArrCents: (subscriptionMrrCents + slotMrrCents) * 12,
    creditPacks30d,
    creditPacksAllTime: sum(revenue, "credit_pack", null),
    gifts30d,
    giftsAllTime: sum(revenue, "gift", null),
    trials: { active: trialing.size, ended: endedTrials.length, converted, rate: endedTrials.length ? converted / endedTrials.length : null },
    churn: { startingFamilies: payingThen.size, churned, rate: churnRate, retention: churnRate === null ? null : 1 - churnRate },
    arpuCents: paying.size ? Math.round((subscriptionMrrCents + slotMrrCents) / paying.size) : null,
    costs30d: { characters, providerCredits, generationUsd, providerExpenseUsd, storageUsd, deliveryUsd, totalUsd },
    revenue30dCents,
    operatingContributionUsd: revenue30dCents / 100 - totalUsd,
    households,
    hasRevenueData: revenue.length > 0,
    costs,
  };
}

async function rows(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<Row[]> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as Row[];
}

type Page = { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** Every row, a page at a time (Supabase returns at most 1,000 rows per request). */
async function all(query: () => Page, what: string): Promise<Row[]> {
  const size = 1000;
  const out: Row[] = [];
  for (let from = 0; ; from += size) {
    const page = await rows(query().range(from, from + size - 1), what);
    out.push(...page);
    if (page.length < size) return out;
  }
}

/** Reads what the report needs with the service key. `live` picks live-mode or test-mode payments. */
export async function loadFinance(db: SupabaseClient, { live, at = new Date() }: { live: boolean; at?: Date }): Promise<FinanceReport> {
  const since = new Date(at.getTime() - WINDOW_DAYS * DAY).toISOString();
  const jobsSince = new Date(at.getTime() - 2 * WINDOW_DAYS * DAY).toISOString();
  const [entitlements, revenue, members, adults, voices, usage, jobs, plays, stored, saved] = await Promise.all([
    all(() => db.from("household_entitlements").select("id, household_id, source, status, extra_narrator_slots, starts_at, ends_at"), "read plans"),
    all(() => db.from("revenue_events").select("household_id, kind, amount_cents, billing_interval, period_start, period_end, occurred_at").eq("livemode", live), "read revenue"),
    all(() => db.from("household_members").select("household_id, user_id").is("removed_at", null), "read members"),
    all(() => db.from("adult_profiles").select("user_id"), "read grown-ups"),
    all(() => db.from("voice_profiles").select("owner_id").eq("status", "ready").is("deleted_at", null), "read voices"),
    all(() => db.from("narration_provider_usage").select("library_key, sentence_id, model_id, characters, provider_credits, bytes").gte("at", since), "read provider usage"),
    all(() => db.from("narration_jobs").select("library_key, household_id, sentence_ids").gte("created_at", jobsSince), "read jobs"),
    db.from("narration_plays").select("id", { count: "exact", head: true }).gte("at", since),
    all(() => db.from("narration_provider_usage").select("bytes"), "read stored audio"),
    savedCostSettings(db),
  ]);
  if (plays.error) throw new Error(`count plays: ${plays.error.message}`);
  const report = financeReport({
    at,
    entitlements,
    revenue,
    members,
    adultIds: adults.map((a) => a.user_id as string),
    voices,
    usage,
    jobs,
    plays: plays.count ?? 0,
    storedBytes: stored.reduce((s, r) => s + int(r.bytes), 0),
    costs: costConfig(process.env, saved),
  });
  const shown = report.households.slice(0, 50);
  if (shown.length) {
    const homes = await rows(db.from("households").select("id, name").in("id", shown.map((h) => h.householdId)), "read family names");
    for (const h of shown) h.name = homes.find((x) => x.id === h.householdId)?.name as string | undefined;
  }
  return report;
}

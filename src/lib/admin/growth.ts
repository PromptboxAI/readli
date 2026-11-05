import type { SupabaseClient } from "@supabase/supabase-js";
import { channelFor, type Channel } from "@/lib/marketing/first-touch";

type Row = Record<string, unknown>;

const DAY = 86_400_000;
const WEEK = 7 * DAY;
export const COHORT_MONTHS = 6;
const ENGAGEMENT_WEEKS = 8;
const CHANNEL_WINDOW_DAYS = 90;
const CANCEL_WINDOW_DAYS = 90;
/** A storyteller invite accepted this close to the family's start is what brought the family in. */
const INVITE_START_WINDOW = 2 * DAY;
/** Listening that starts between 5pm and 10pm in the family's time zone counts as bedtime. */
const BEDTIME_HOURS = [17, 22] as const;

const ts = (v: unknown) => (typeof v === "string" ? Date.parse(v) : NaN);
const int = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;

/**
 * The investor-facing numbers on /admin/growth. Every figure is an aggregate across families: nothing
 * here names a child, and the cancel comments are the grown-up's own words from Stripe's cancel survey.
 */
export interface GrowthInputs {
  at: Date;
  /** id, created_at */
  households: Row[];
  /** household_id, source, status, starts_at, ends_at */
  entitlements: Row[];
  /** revenue_events for the chosen mode: household_id, kind, amount_cents, period_start, period_end, occurred_at */
  revenue: Row[];
  /** household_acquisition rows */
  acquisition: Row[];
  /** referrals: referred_household_id, rejected_reason */
  referrals: Row[];
  /** Accepted storyteller invitations: household_id, accepted_at */
  invitations: Row[];
  /** Live voice shares to families whose voice is ready: voice_id, household_id */
  shares: Row[];
  /** subscription_cancellations for the chosen mode */
  cancellations: Row[];
  /** Listening sessions in the engagement window: household_id, child_id, started_at */
  sessions: Row[];
  /** A time zone per family where a guardian has saved one. */
  timeZones: Map<string, string>;
}

export interface CohortRow {
  month: string;
  families: number;
  /** Share still paying k months after their first payment, k = 1..COHORT_MONTHS; null until that month arrives. */
  retained: (number | null)[];
}

export interface RetentionBySegment {
  label: string;
  families: number;
  m1: number | null;
  m3: number | null;
  m6: number | null;
}

export interface ChannelRow {
  channel: Channel;
  /** Families started in the last CHANNEL_WINDOW_DAYS. */
  started: number;
  /** Of those, how many have paid. */
  startedAndPaid: number;
  /** Every family from this channel that has ever paid. */
  payingEver: number;
  m3: number | null;
}

export interface CancelSummary {
  total: number;
  voluntary: number;
  involuntary: number;
  withdrawn: number;
  byFeedback: { feedback: string; count: number }[];
  recentComments: { at: string; feedback: string | null; comment: string }[];
}

export interface WeekRow {
  weekOf: string;
  activeChildren: number;
  activeFamilies: number;
  /** Average days with listening per active child that week. */
  daysPerChild: number | null;
  /** Share of sessions that started at bedtime, among families with a known time zone. */
  bedtimeShare: number | null;
}

export interface GrowthReport {
  cohorts: CohortRow[];
  segments: RetentionBySegment[];
  channels: ChannelRow[];
  /** Families whose source is known (started after tracking shipped). */
  trackedFamilies: number;
  cancels: CancelSummary;
  weeks: WeekRow[];
  /** Paying families with any listening in the last 7 days. */
  payingActive7d: { active: number; paying: number; rate: number | null };
  hasPayments: boolean;
}

export function addMonths(t: number, k: number): number {
  const d = new Date(t);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return target.getTime();
}

const monthKey = (t: number) => new Date(t).toISOString().slice(0, 7);

/** The first day each family paid for a subscription itself (gifts, trials and complimentary plans never count). */
export function firstPaid(revenue: Row[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of revenue) {
    if (r.kind !== "subscription" || int(r.amount_cents) <= 0 || !r.household_id) continue;
    const t = Number.isFinite(ts(r.period_start)) ? ts(r.period_start) : ts(r.occurred_at);
    if (!Number.isFinite(t)) continue;
    const h = r.household_id as string;
    if (!out.has(h) || t < out.get(h)!) out.set(h, t);
  }
  return out;
}

/** Paying at a moment: a paid subscription period covers it, or the family's own subscription plan does. */
function payingAt(household: string, t: number, revenueBy: Map<string, Row[]>, plansBy: Map<string, Row[]>): boolean {
  for (const r of revenueBy.get(household) ?? []) {
    if (r.kind === "subscription" && int(r.amount_cents) > 0 && ts(r.period_start) <= t && ts(r.period_end) > t) return true;
  }
  for (const e of plansBy.get(household) ?? []) {
    if (e.source !== "subscription" || ts(e.starts_at) > t) continue;
    if (e.ends_at === null || e.ends_at === undefined ? e.status === "active" : ts(e.ends_at) > t) return true;
  }
  return false;
}

function groupBy(rows: Row[], key: string): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r[key] as string | null | undefined;
    if (!k) continue;
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push(r);
  }
  return out;
}

/** Retention k months on, among families whose k-th month has arrived. */
function retentionAt(families: string[], k: number, now: number, first: Map<string, number>, revenueBy: Map<string, Row[]>, plansBy: Map<string, Row[]>): number | null {
  let eligible = 0;
  let kept = 0;
  for (const h of families) {
    const t = addMonths(first.get(h)!, k);
    if (t > now) continue;
    eligible++;
    if (payingAt(h, t, revenueBy, plansBy)) kept++;
  }
  return eligible ? kept / eligible : null;
}

function localHour(t: number, timeZone: string): number | null {
  try {
    const h = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date(t));
    const n = Number(h);
    return Number.isFinite(n) ? n % 24 : null;
  } catch {
    return null;
  }
}

/** Monday 00:00 UTC of the week holding t. */
function weekStart(t: number): number {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

export function growthReport(input: GrowthInputs): GrowthReport {
  const now = input.at.getTime();
  const first = firstPaid(input.revenue);
  const revenueBy = groupBy(input.revenue, "household_id");
  const plansBy = groupBy(input.entitlements, "household_id");
  const paidFamilies = [...first.keys()];

  // Cohorts by the month of first payment.
  const byMonth = new Map<string, string[]>();
  for (const h of paidFamilies) {
    const m = monthKey(first.get(h)!);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(h);
  }
  const cohorts = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 12)
    .map(([month, families]) => ({
      month,
      families: families.length,
      retained: Array.from({ length: COHORT_MONTHS }, (_, i) => retentionAt(families, i + 1, now, first, revenueBy, plansBy)),
    }));

  // Retention by how many family voices a family has now.
  const voices = new Map<string, Set<string>>();
  for (const s of input.shares) {
    const h = s.household_id as string;
    if (!voices.has(h)) voices.set(h, new Set());
    voices.get(h)!.add(s.voice_id as string);
  }
  const segment = (label: string, families: string[]): RetentionBySegment => ({
    label,
    families: families.length,
    m1: retentionAt(families, 1, now, first, revenueBy, plansBy),
    m3: retentionAt(families, 3, now, first, revenueBy, plansBy),
    m6: retentionAt(families, 6, now, first, revenueBy, plansBy),
  });
  const segments = [
    segment("All paying families", paidFamilies),
    segment("No voice or one voice", paidFamilies.filter((h) => (voices.get(h)?.size ?? 0) < 2)),
    segment("Two or more voices", paidFamilies.filter((h) => (voices.get(h)?.size ?? 0) >= 2)),
  ];

  // Channels.
  const created = new Map(input.households.map((h) => [h.id as string, ts(h.created_at)]));
  const acquisition = new Map(input.acquisition.map((a) => [a.household_id as string, a]));
  const referred = new Set(input.referrals.filter((r) => !r.rejected_reason).map((r) => r.referred_household_id as string));
  const invited = new Set(
    input.invitations
      .filter((i) => {
        const start = created.get(i.household_id as string);
        return start !== undefined && Number.isFinite(start) && ts(i.accepted_at) - start <= INVITE_START_WINDOW;
      })
      .map((i) => i.household_id as string),
  );
  const gifted = new Set<string>();
  for (const e of input.entitlements) {
    if (e.source !== "gift" && e.source !== "sponsored") continue;
    const h = e.household_id as string;
    const paid = first.get(h);
    if (paid === undefined || ts(e.starts_at) <= paid) gifted.add(h);
  }
  const channelOf = (h: string) => channelFor({ referred: referred.has(h), invited: invited.has(h), gifted: gifted.has(h), acquisition: (acquisition.get(h) as Row | undefined) ?? null });
  const since = now - CHANNEL_WINDOW_DAYS * DAY;
  const rows = new Map<Channel, { started: number; startedAndPaid: number; paying: string[] }>();
  const bucket = (c: Channel) => {
    if (!rows.has(c)) rows.set(c, { started: 0, startedAndPaid: 0, paying: [] });
    return rows.get(c)!;
  };
  for (const [h, t] of created) {
    if (!(t >= since)) continue;
    const b = bucket(channelOf(h));
    b.started++;
    if (first.has(h)) b.startedAndPaid++;
  }
  for (const h of paidFamilies) bucket(channelOf(h)).paying.push(h);
  const channels = [...rows.entries()]
    .map(([channel, b]) => ({ channel, started: b.started, startedAndPaid: b.startedAndPaid, payingEver: b.paying.length, m3: retentionAt(b.paying, 3, now, first, revenueBy, plansBy) }))
    .sort((a, b) => b.payingEver - a.payingEver || b.started - a.started);

  // Cancellations.
  const cancelSince = now - CANCEL_WINDOW_DAYS * DAY;
  const recent = input.cancellations.filter((c) => ts(c.requested_at) >= cancelSince);
  const feedback = new Map<string, number>();
  for (const c of recent) {
    if (c.reason === "payment_failed" || c.reason === "payment_disputed") continue;
    const f = (c.feedback as string | null) ?? "not_answered";
    feedback.set(f, (feedback.get(f) ?? 0) + 1);
  }
  const cancels: CancelSummary = {
    total: recent.length,
    involuntary: recent.filter((c) => c.reason === "payment_failed" || c.reason === "payment_disputed").length,
    voluntary: recent.filter((c) => c.reason !== "payment_failed" && c.reason !== "payment_disputed").length,
    withdrawn: recent.filter((c) => c.withdrawn_at).length,
    byFeedback: [...feedback.entries()].map(([f, count]) => ({ feedback: f, count })).sort((a, b) => b.count - a.count),
    recentComments: recent
      .filter((c) => typeof c.comment === "string" && c.comment)
      .sort((a, b) => ts(b.requested_at) - ts(a.requested_at))
      .slice(0, 10)
      .map((c) => ({ at: c.requested_at as string, feedback: (c.feedback as string | null) ?? null, comment: c.comment as string })),
  };

  // Engagement by week.
  const thisWeek = weekStart(now);
  const weeks: WeekRow[] = [];
  for (let i = ENGAGEMENT_WEEKS - 1; i >= 0; i--) {
    const start = thisWeek - i * WEEK;
    const end = start + WEEK;
    const inWeek = input.sessions.filter((s) => ts(s.started_at) >= start && ts(s.started_at) < end);
    const days = new Map<string, Set<string>>();
    const families = new Set<string>();
    let timed = 0;
    let bedtime = 0;
    for (const s of inWeek) {
      const child = s.child_id as string;
      const h = s.household_id as string;
      const t = ts(s.started_at);
      families.add(h);
      if (!days.has(child)) days.set(child, new Set());
      const zone = input.timeZones.get(h);
      const hour = zone ? localHour(t, zone) : null;
      const localDay = zone ? new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date(t)) : new Date(t).toISOString().slice(0, 10);
      days.get(child)!.add(localDay);
      if (hour !== null) {
        timed++;
        if (hour >= BEDTIME_HOURS[0] && hour < BEDTIME_HOURS[1]) bedtime++;
      }
    }
    const totalDays = [...days.values()].reduce((n, d) => n + d.size, 0);
    weeks.push({
      weekOf: new Date(start).toISOString().slice(0, 10),
      activeChildren: days.size,
      activeFamilies: families.size,
      daysPerChild: days.size ? totalDays / days.size : null,
      bedtimeShare: timed ? bedtime / timed : null,
    });
  }

  const payingNow = paidFamilies.filter((h) => payingAt(h, now, revenueBy, plansBy));
  const listened = new Set(input.sessions.filter((s) => ts(s.started_at) >= now - WEEK).map((s) => s.household_id as string));
  const active = payingNow.filter((h) => listened.has(h)).length;

  return {
    cohorts,
    segments,
    channels,
    trackedFamilies: input.acquisition.length,
    cancels,
    weeks,
    payingActive7d: { active, paying: payingNow.length, rate: payingNow.length ? active / payingNow.length : null },
    hasPayments: paidFamilies.length > 0,
  };
}

async function rows(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<Row[]> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as Row[];
}

/** Rows from a table the growth migration adds; empty until it runs, so the page still loads. */
async function optional(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await p;
  return error ? [] : ((data ?? []) as Row[]);
}

type Page = { range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

async function all(query: () => Page, what: string, optionalTable = false): Promise<Row[]> {
  const size = 1000;
  const out: Row[] = [];
  for (let from = 0; ; from += size) {
    const p = query().range(from, from + size - 1);
    const page = optionalTable ? await optional(p) : await rows(p, what);
    out.push(...page);
    if (page.length < size) return out;
  }
}

/** Reads what the growth report needs with the service key. `live` picks live-mode or test-mode payments. */
export async function loadGrowth(db: SupabaseClient, { live, at = new Date() }: { live: boolean; at?: Date }): Promise<GrowthReport> {
  const sessionsSince = new Date(weekStart(at.getTime()) - (ENGAGEMENT_WEEKS - 1) * WEEK).toISOString();
  const [households, entitlements, revenue, acquisition, referrals, invitations, shares, readyVoices, cancellations, sessions, guardians, zones] = await Promise.all([
    all(() => db.from("households").select("id, created_at"), "read families"),
    all(() => db.from("household_entitlements").select("household_id, source, status, starts_at, ends_at"), "read plans"),
    all(() => db.from("revenue_events").select("household_id, kind, amount_cents, period_start, period_end, occurred_at").eq("livemode", live), "read revenue"),
    all(() => db.from("household_acquisition").select("household_id, source, medium, campaign, click_id, referrer_host"), "read acquisition", true),
    all(() => db.from("referrals").select("referred_household_id, rejected_reason"), "read referrals"),
    all(() => db.from("voice_invitations").select("household_id, accepted_at").not("accepted_at", "is", null).not("household_id", "is", null), "read invitations", true),
    all(() => db.from("voice_household_shares").select("voice_id, household_id").is("revoked_at", null), "read voice shares"),
    all(() => db.from("voice_profiles").select("id").eq("status", "ready").is("deleted_at", null), "read voices"),
    all(() => db.from("subscription_cancellations").select("reason, feedback, comment, requested_at, withdrawn_at").eq("livemode", live), "read cancellations", true),
    all(() => db.from("listening_sessions").select("household_id, child_id, started_at").gte("started_at", sessionsSince), "read listening"),
    all(() => db.from("household_members").select("household_id, user_id").eq("role", "guardian").is("removed_at", null), "read guardians"),
    all(() => db.from("email_preferences").select("user_id, time_zone").not("time_zone", "is", null), "read time zones", true),
  ]);
  const ready = new Set(readyVoices.map((v) => v.id as string));
  const zoneByUser = new Map(zones.map((z) => [z.user_id as string, z.time_zone as string]));
  const timeZones = new Map<string, string>();
  for (const g of guardians) {
    const zone = zoneByUser.get(g.user_id as string);
    if (zone && !timeZones.has(g.household_id as string)) timeZones.set(g.household_id as string, zone);
  }
  return growthReport({
    at,
    households,
    entitlements,
    revenue,
    acquisition,
    referrals,
    invitations,
    shares: shares.filter((s) => ready.has(s.voice_id as string)),
    cancellations,
    sessions,
    timeZones,
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreditSource, FamilyState } from "@/lib/family/model";
import { calledIn } from "@/lib/family/names";
import type { PlanConfig } from "@/lib/family/plan";
import { spendableLots } from "@/lib/narration/credits";
import { libraryText } from "@/lib/narration/narration";
import { bookText } from "@/lib/narration/text";
import { AdminActionError } from "./tester-plans";

/**
 * A family's credits and billing as support sees them (Kevin, 2026-11-08): every grant and purchase
 * with what's left of it, every charge and return, the family's plans over time, payments and
 * cancellations, and taking back a promotional grant made by mistake.
 */

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);

async function rows(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<Row[]> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as Row[];
}

export interface SupportLot {
  id: string;
  source: CreditSource;
  note: string;
  grantedAt: string;
  expiresAt: string | null;
  /** All in units (characters). */
  credits: number;
  used: number;
  /** Set aside for preparations still running. */
  held: number;
  left: number;
  live: boolean;
  /** A promotional grant with nothing held, which support can take back. */
  canTakeBack: boolean;
}

export interface SupportCharge {
  at: string;
  jobId: string;
  what: string;
  status: string;
  /** Units: still held, used, and returned to the family. */
  held: number;
  used: number;
  returned: number;
}

const JOB: Record<string, string> = { queued: "Preparing", running: "Preparing", done: "Finished", failed: "Stopped with errors", canceled: "Stopped" };

/** Every credit lot the family has had (this month's included credits included), and every preparation's charges, newest first. */
export function supportCredits(state: FamilyState, plan: PlanConfig, householdId: string, at = new Date().toISOString()): { lots: SupportLot[]; charges: SupportCharge[] } {
  const live = new Map(spendableLots(state, plan, householdId, at).map((l) => [l.lot.id, l]));
  const ledger = state.ledger.filter((e) => e.householdId === householdId);
  const sums = (lotId: string) => {
    const mine = ledger.filter((e) => e.lotId === lotId);
    const sum = (kind: string) => mine.filter((e) => e.kind === kind).reduce((n, e) => n + e.credits, 0);
    return { reserved: sum("reserve") - sum("refund"), committed: sum("commit") };
  };
  const stored = state.creditLots.filter((l) => l.householdId === householdId);
  const derived = [...live.values()].map((l) => l.lot).filter((l) => !stored.some((s) => s.id === l.id));
  const lots = [...derived, ...stored]
    .map((lot) => {
      const { reserved, committed } = sums(lot.id);
      const held = Math.max(0, reserved - committed);
      const isLive = live.has(lot.id);
      return {
        id: lot.id,
        source: lot.source,
        note: lot.note,
        grantedAt: lot.grantedAt,
        expiresAt: lot.expiresAt,
        credits: lot.credits,
        used: committed,
        held,
        left: isLive ? live.get(lot.id)!.left : 0,
        live: isLive,
        canTakeBack: lot.source === "promotional" && isLive && held === 0 && live.get(lot.id)!.left > 0,
      };
    })
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
  const charges = state.jobs
    .filter((j) => j.householdId === householdId)
    .map((job) => {
      const library = state.libraries.find((l) => l.key === job.libraryKey);
      const text = library ? (libraryText(library) ?? bookText(library.bookSlug)) : null;
      const voice = library ? state.voices.find((v) => v.id === library.voiceId) : undefined;
      const narrator = calledIn(state, state.adults.find((a) => a.id === voice?.ownerId), householdId)?.displayName;
      const mine = ledger.filter((e) => e.jobId === job.id);
      const sum = (kind: string) => mine.filter((e) => e.kind === kind).reduce((n, e) => n + e.credits, 0);
      const running = job.status === "queued" || job.status === "running";
      return {
        at: job.createdAt,
        jobId: job.id,
        what: `${text?.title ?? "A book"}${narrator ? ` read by ${narrator}` : ""}${job.scope === "chapter" ? " (a chapter)" : job.scope === "passage" ? " (a passage)" : ""}`,
        status: JOB[job.status] ?? job.status,
        held: running ? Math.max(0, sum("reserve") - sum("refund") - sum("commit")) : 0,
        used: sum("commit"),
        returned: sum("refund"),
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
  return { lots, charges };
}

/**
 * Takes back what's left of a promotional grant (one given by mistake, say) by ending it now. What was
 * already used stays used. A grant with credits held for a running preparation can't be taken back.
 */
export async function takeBackGrant(db: SupabaseClient, state: FamilyState, plan: PlanConfig, householdId: string, lotId: string, now = new Date()): Promise<{ units: number; note: string }> {
  const lot = supportCredits(state, plan, householdId, now.toISOString()).lots.find((l) => l.id === lotId);
  if (!lot) throw new AdminActionError("That grant isn't in this family.");
  if (lot.source !== "promotional") throw new AdminActionError("Only promotional credits can be taken back. Purchased and monthly credits stay.");
  if (!lot.live || lot.left === 0) throw new AdminActionError("Nothing is left of that grant to take back.");
  if (lot.held > 0) throw new AdminActionError("Some of that grant is held for a preparation that's still running. Stop it first, or wait for it to finish.");
  const { error } = await db
    .from("narration_credit_lots")
    .update({ expires_at: now.toISOString() })
    .eq("id", lotId)
    .eq("household_id", householdId)
    .eq("source", "promotional");
  if (error) throw new Error(`take back credits: ${error.message}`);
  return { units: lot.left, note: lot.note };
}

export interface SupportPlanRow {
  id: string;
  source: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  note: string | null;
  live: boolean;
}

export interface SupportPayment {
  at: string;
  kind: string;
  amountCents: number;
  currency: string;
  interval: string | null;
  quantity: number;
  livemode: boolean;
}

export interface SupportBilling {
  plans: SupportPlanRow[];
  payments: SupportPayment[];
  /** The family's Stripe customer, with a link to it in the Stripe dashboard. */
  customer: { ref: string; url: string } | null;
  cancellations: { requestedAt: string; endsAt: string | null; reason: string | null; feedback: string | null; comment: string | null; withdrawnAt: string | null }[];
}

/** The family's plans over time, its payments, its Stripe customer and its cancellations. */
export async function supportBilling(db: SupabaseClient, householdId: string, now = new Date()): Promise<SupportBilling> {
  const [plans, payments, customers, cancellations] = await Promise.all([
    rows(db.from("household_entitlements").select("id, source, status, starts_at, ends_at, note").eq("household_id", householdId).order("starts_at", { ascending: false }), "read plans"),
    rows(
      db.from("revenue_events").select("occurred_at, kind, amount_cents, currency, billing_interval, quantity, livemode").eq("household_id", householdId).order("occurred_at", { ascending: false }).limit(100),
      "read payments",
    ),
    rows(db.from("billing_customers").select("customer_ref, livemode").eq("household_id", householdId).limit(1), "read billing customer"),
    rows(db.from("subscription_cancellations").select("requested_at, ends_at, reason, feedback, comment, withdrawn_at").eq("household_id", householdId).order("requested_at", { ascending: false }), "read cancellations"),
  ]);
  const t = now.getTime();
  const c = customers[0];
  return {
    plans: plans.map((p) => ({
      id: String(p.id),
      source: String(p.source),
      status: String(p.status),
      startsAt: String(p.starts_at),
      endsAt: str(p.ends_at),
      note: str(p.note),
      live: p.status === "active" && Date.parse(String(p.starts_at)) <= t && (p.ends_at === null || Date.parse(String(p.ends_at)) > t),
    })),
    payments: payments.map((p) => ({
      at: String(p.occurred_at),
      kind: String(p.kind),
      amountCents: Number(p.amount_cents),
      currency: String(p.currency ?? "usd"),
      interval: str(p.billing_interval),
      quantity: Number(p.quantity ?? 1),
      livemode: Boolean(p.livemode),
    })),
    customer: c ? { ref: String(c.customer_ref), url: `https://dashboard.stripe.com/${c.livemode ? "" : "test/"}customers/${encodeURIComponent(String(c.customer_ref))}` } : null,
    cancellations: cancellations.map((x) => ({
      requestedAt: String(x.requested_at),
      endsAt: str(x.ends_at),
      reason: str(x.reason),
      feedback: str(x.feedback),
      comment: str(x.comment),
      withdrawnAt: str(x.withdrawn_at),
    })),
  };
}

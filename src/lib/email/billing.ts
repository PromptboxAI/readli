import type { SupabaseClient } from "@supabase/supabase-js";
import { effectivePlan } from "@/lib/billing/price-settings";
import { AccountFamilyStore } from "@/lib/family/account-store";
import { activeEntitlement } from "@/lib/family/permissions";
import { creditBalance, displayCredits } from "@/lib/narration/credits";
import { queueEmails, type QueuedEmail } from "./outbox";
import { preferencesUrl, unsubscribeHeaders } from "./preferences";
import type { SequenceContext } from "./sequences";
import { readliEmail } from "./templates";

/**
 * Trial, billing and abandoned-checkout email (sequence matrix, "Built but switched off"). Each stays
 * off in /admin until it's tested (Kevin, 2026-10-24, point 12). The Stripe ones read events the
 * billing webhook already stores in payment_events, so nothing in billing changes. Credit amounts are
 * always the live balance from the credits ledger (point 5). Stripe keeps its own receipts and
 * card emails; its trial-ending reminder is turned off so T1 is the only one (point 4).
 */

type Row = Record<string, unknown>;
type Obj = Record<string, unknown>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return (data ?? []) as T;
}

const ago = (now: Date, ms: number) => new Date(now.getTime() - ms).toISOString();
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const ref = (v: unknown): string | null => str(v) ?? str((v as Obj | null)?.id);
const iso = (seconds: unknown): string | null => (typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null);
const day = (at: string) => new Date(at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

interface StoredEvent {
  type: string;
  receivedAt: string;
  object: Obj;
}

async function events(db: SupabaseClient, types: string[], since: string): Promise<StoredEvent[]> {
  const rows = await q(db.from("payment_events").select("type, payload, received_at").in("type", types).gte("received_at", since).order("received_at"), "read payment events");
  return rows.map((r) => ({ type: r.type as string, receivedAt: r.received_at as string, object: ((r.payload as Obj | null)?.data as Obj | undefined)?.object as Obj })).filter((e) => e.object);
}

/** The newest state Stripe sent for each subscription, from the last `days` of subscription events. */
async function latestSubscriptions(db: SupabaseClient, now: Date, days: number): Promise<Map<string, Obj>> {
  const out = new Map<string, Obj>();
  const subs = await events(db, ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.trial_will_end"], ago(now, days * DAY));
  for (const e of subs) {
    const id = str(e.object.id);
    if (id) out.set(id, e.type === "customer.subscription.deleted" ? { ...e.object, status: "canceled" } : e.object);
  }
  return out;
}

const items = (sub: Obj) => (((sub.items as Obj | undefined)?.data as Obj[] | undefined) ?? []);

/** The first charge after the trial, when Stripe's subscription says it plainly (no discount to work out). */
function nextCharge(sub: Obj): { amount: string; interval: string } | null {
  const list = items(sub);
  if (!list.length || sub.discount || (Array.isArray(sub.discounts) && sub.discounts.length)) return null;
  let cents = 0;
  let currency = "usd";
  let interval = "";
  for (const i of list) {
    const price = (i.price as Obj | undefined) ?? {};
    if (typeof price.unit_amount !== "number") return null;
    cents += price.unit_amount * (typeof i.quantity === "number" ? i.quantity : 1);
    currency = str(price.currency) ?? currency;
    interval = str((price.recurring as Obj | undefined)?.interval) ?? interval;
  }
  return interval ? { amount: money(cents, currency), interval } : null;
}

async function owners(db: SupabaseClient, householdIds: string[]): Promise<Map<string, { userId: string; name: string }>> {
  const out = new Map<string, { userId: string; name: string }>();
  if (!householdIds.length) return out;
  const homes = await q(db.from("households").select("id, created_by").in("id", householdIds), "read households");
  const ids = homes.map((h) => h.created_by as string);
  const guardians = new Set(
    (await q(db.from("household_members").select("household_id, user_id").in("household_id", householdIds).eq("role", "guardian").is("removed_at", null), "read guardians")).map(
      (m) => `${m.household_id}:${m.user_id}`,
    ),
  );
  const names = new Map((await q(db.from("adult_profiles").select("user_id, display_name").in("user_id", ids), "read names")).map((r) => [r.user_id as string, String(r.display_name ?? "").trim().split(/\s+/)[0] ?? ""]));
  for (const h of homes) if (guardians.has(`${h.id}:${h.created_by}`)) out.set(h.id as string, { userId: h.created_by as string, name: names.get(h.created_by as string) ?? "" });
  return out;
}

type Credits = { available: number; allowance: number; credits: number };
export type CreditLookup = (db: SupabaseClient, householdId: string, owner: { userId: string; name: string }, now: Date) => Promise<Credits | null>;
/** Tests pass their own credit lookup; otherwise credits are read from the family ledger. */
export type BillingContext = SequenceContext & { credits?: CreditLookup };

/** Live credits for a household, read from the ledger, or null if they can't be read. */
async function creditsLeft(db: SupabaseClient, householdId: string, owner: { userId: string; name: string }, now: Date) {
  try {
    const plan = await effectivePlan(db);
    const state = await new AccountFamilyStore(db, { id: owner.userId, name: owner.name || "Grown-up" }, plan).read();
    const at = now.toISOString();
    const b = creditBalance(state, plan, householdId, at);
    return activeEntitlement(state, householdId, at) ? { available: b.available, allowance: b.allowance, credits: displayCredits(b.available, b.unitsPerCredit) } : null;
  } catch (err) {
    console.error("billing email credits failed", householdId, err);
    return null;
  }
}

const creditText = (n: number) => `${n.toLocaleString("en-US")} narration ${n === 1 ? "credit" : "credits"}`;

function billingMessage(ctx: SequenceContext, userId: string, name: string, m: { subject: string; title: string; paragraphs: string[]; cta: string; path: string }) {
  return readliEmail({
    subject: m.subject,
    name,
    title: m.title,
    paragraphs: m.paragraphs,
    cta: { label: m.cta, url: `${ctx.base}${m.path}` },
    reason: "You're getting this because you look after a Readli Family plan.",
    preferencesUrl: preferencesUrl(ctx.base, ctx.secret, userId),
  });
}

/** T1: Stripe's trial_will_end (3 days before), unless the trial was canceled or already converted. */
export async function trialEnding(ctx: BillingContext): Promise<QueuedEmail[]> {
  if (!ctx.enabled.has("T1")) return [];
  const warnings = await events(ctx.db, ["customer.subscription.trial_will_end"], ago(ctx.now, 2 * DAY));
  if (!warnings.length) return [];
  const latest = await latestSubscriptions(ctx.db, ctx.now, 40);
  const homes = await owners(ctx.db, [...new Set(warnings.map((w) => str((w.object.metadata as Obj | undefined)?.household_id)).filter((h): h is string => Boolean(h)))]);
  const out: QueuedEmail[] = [];
  for (const w of warnings) {
    const subId = str(w.object.id);
    const householdId = str((w.object.metadata as Obj | undefined)?.household_id);
    const sub = subId ? (latest.get(subId) ?? w.object) : null;
    const owner = householdId ? homes.get(householdId) : undefined;
    const trialEnd = sub ? iso(sub.trial_end) : null;
    if (!subId || !householdId || !owner || !sub || !trialEnd) continue;
    if (sub.status !== "trialing" || sub.cancel_at_period_end || sub.cancel_at || new Date(trialEnd).getTime() <= ctx.now.getTime()) continue;
    const charge = nextCharge(sub);
    const credits = await (ctx.credits ?? creditsLeft)(ctx.db, householdId, owner, ctx.now);
    out.push({
      emailId: "T1",
      dedupeKey: `T1:${subId}`,
      to: { userId: owner.userId },
      householdId,
      message: billingMessage(ctx, owner.userId, owner.name, {
        subject: `Your Readli trial ends on ${day(trialEnd)}`,
        title: `Your free trial ends on ${day(trialEnd)}`,
        paragraphs: [
          "We hope bedtime has been extra cozy with Readli! Here's a quick heads-up so nothing surprises you.",
          charge
            ? `After that, Readli Family is ${charge.amount} a ${charge.interval}, charged to your card on ${day(trialEnd)} and every ${charge.interval} after until you cancel.`
            : `After that, your Readli Family plan starts and your card is charged on ${day(trialEnd)}. Billing shows the exact amount.`,
          ...(credits ? [`You have ${creditText(credits.credits)} left right now.`] : []),
          "If Readli isn't for you, just cancel in Billing before then and you won't be charged.",
        ],
        cta: "Manage or cancel",
        path: "/family/billing",
      }),
    });
  }
  return out;
}

/** Households on a trial right now: a Readli trial, or a Stripe subscription still trialing. */
async function trialHouseholds(db: SupabaseClient, now: Date): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const at = now.toISOString();
  const trials = await q(db.from("household_entitlements").select("id, household_id, ends_at").eq("source", "trial").eq("status", "active"), "read trials");
  for (const t of trials) if (!t.ends_at || (t.ends_at as string) > at) out.set(t.household_id as string, `trial:${t.id}`);
  for (const [id, sub] of await latestSubscriptions(db, now, 40)) {
    const householdId = str((sub.metadata as Obj | undefined)?.household_id);
    if (householdId && sub.status === "trialing") out.set(householdId, `stripe:${id}`);
  }
  return out;
}

export const LOW_TRIAL_SHARE = 0.2;

/** T2: a trial's credits drop below 20% of its allowance, once per trial. */
export async function trialCreditsLow(ctx: BillingContext): Promise<QueuedEmail[]> {
  if (!ctx.enabled.has("T2")) return [];
  const trials = await trialHouseholds(ctx.db, ctx.now);
  if (!trials.size) return [];
  const sent = new Set((await q(ctx.db.from("email_outbox").select("dedupe_key").in("dedupe_key", [...trials.values()].map((t) => `T2:${t}`)), "read queued email")).map((r) => r.dedupe_key as string));
  const homes = await owners(ctx.db, [...trials.keys()]);
  const out: QueuedEmail[] = [];
  for (const [householdId, trial] of trials) {
    const owner = homes.get(householdId);
    if (!owner || sent.has(`T2:${trial}`)) continue;
    const credits = await (ctx.credits ?? creditsLeft)(ctx.db, householdId, owner, ctx.now);
    if (!credits || credits.allowance <= 0 || credits.available >= credits.allowance * LOW_TRIAL_SHARE) continue;
    out.push({
      emailId: "T2",
      dedupeKey: `T2:${trial}`,
      to: { userId: owner.userId },
      householdId,
      message: billingMessage(ctx, owner.userId, owner.name, {
        subject: "Your family is loving Readli!",
        title: "You've used most of your trial credits",
        paragraphs: [
          `You have ${creditText(credits.credits)} left in your trial, and every story you've made stays on your shelf to play again.`,
          "Pop into Credits to see what's left and what the next story will take.",
        ],
        cta: "See my credits",
        path: "/family/credits",
      }),
    });
  }
  return out;
}

/** B1: 30 days before a yearly plan renews (from Stripe's subscription), unless renewal is off. */
export async function yearlyRenewal(ctx: BillingContext): Promise<QueuedEmail[]> {
  if (!ctx.enabled.has("B1")) return [];
  const latest = await latestSubscriptions(ctx.db, ctx.now, 400);
  const due: { subId: string; householdId: string; renewsAt: string; charge: ReturnType<typeof nextCharge> }[] = [];
  for (const [subId, sub] of latest) {
    const householdId = str((sub.metadata as Obj | undefined)?.household_id);
    const renewsAt = iso(sub.current_period_end) ?? iso(items(sub)[0]?.current_period_end);
    const yearly = items(sub).some((i) => (i.price as Obj | undefined)?.recurring && ((i.price as Obj).recurring as Obj).interval === "year");
    if (!householdId || !renewsAt || !yearly || sub.status !== "active" || sub.cancel_at_period_end || sub.cancel_at) continue;
    const left = new Date(renewsAt).getTime() - ctx.now.getTime();
    if (left > 30 * DAY || left < 25 * DAY) continue;
    due.push({ subId, householdId, renewsAt, charge: nextCharge(sub) });
  }
  const homes = await owners(ctx.db, due.map((d) => d.householdId));
  return due.flatMap((d) => {
    const owner = homes.get(d.householdId);
    if (!owner) return [];
    return [
      {
        emailId: "B1",
        dedupeKey: `B1:${d.subId}:${d.renewsAt.slice(0, 10)}`,
        to: { userId: owner.userId },
        householdId: d.householdId,
        message: billingMessage(ctx, owner.userId, owner.name, {
          subject: `Your Readli plan renews on ${day(d.renewsAt)}`,
          title: `Your yearly plan renews on ${day(d.renewsAt)}`,
          paragraphs: [
            "Thank you for a whole year of stories with Readli!",
            d.charge ? `On ${day(d.renewsAt)}, your card is charged ${d.charge.amount} for another year of Readli Family.` : `On ${day(d.renewsAt)}, your card is charged for another year of Readli Family. Billing shows the exact amount.`,
            "Nothing to do if you'd like to keep going. To change or cancel, open Billing before then.",
          ],
          cta: "Manage my plan",
          path: "/family/billing",
        }),
      },
    ];
  });
}

/** B2: 7 days before a gift ends, to the recipient, unless it renews or they already have their own plan. */
export async function giftEnding(ctx: BillingContext): Promise<QueuedEmail[]> {
  if (!ctx.enabled.has("B2")) return [];
  const gifts = await q(
    ctx.db
      .from("gifts")
      .select("id, plan_id, recipient_user_id, giver_display_name, paid_through, renewals_stopped")
      .eq("status", "active")
      .gte("paid_through", ctx.now.toISOString())
      .lte("paid_through", new Date(ctx.now.getTime() + 7 * DAY).toISOString()),
    "read gifts",
  );
  const out: QueuedEmail[] = [];
  for (const g of gifts) {
    const userId = str(g.recipient_user_id);
    const endsAt = g.paid_through as string;
    if (!userId || (g.plan_id === "sponsored_monthly" && !g.renewals_stopped)) continue;
    const homes = await q(ctx.db.from("household_members").select("household_id").eq("user_id", userId).eq("role", "guardian").is("removed_at", null), "read recipient household");
    const householdIds = homes.map((h) => h.household_id as string);
    if (householdIds.length) {
      const own = await q(ctx.db.from("household_entitlements").select("id, ends_at").in("household_id", householdIds).eq("source", "subscription").eq("status", "active"), "read plans");
      if (own.some((e) => !e.ends_at || (e.ends_at as string) > endsAt)) continue;
    }
    const names = await q(ctx.db.from("adult_profiles").select("display_name").eq("user_id", userId).limit(1), "read name");
    const name = String(names[0]?.display_name ?? "").trim().split(/\s+/)[0] ?? "";
    out.push({
      emailId: "B2",
      dedupeKey: `B2:${g.id}:${endsAt.slice(0, 10)}`,
      to: { userId },
      householdId: householdIds[0] ?? null,
      message: billingMessage(ctx, userId, name, {
        subject: `Your gift from ${g.giver_display_name} ends on ${day(endsAt)}`,
        title: `Your Readli gift ends on ${day(endsAt)}`,
        paragraphs: [
          `${g.giver_display_name}'s gift of Readli Family runs until ${day(endsAt)}. Every story you've made stays on your shelf.`,
          "Want the stories to keep coming? You can pick a plan of your own in Billing whenever you like. Nothing happens unless you do.",
        ],
        cta: "See plans",
        path: "/family/billing",
      }),
    });
  }
  return out;
}

/** K1: a Family plan or credit pack checkout that expired unpaid, a day later, with marketing consent. */
export async function abandonedCheckout(ctx: BillingContext): Promise<QueuedEmail[]> {
  if (!ctx.enabled.has("K1")) return [];
  const expired = (await events(ctx.db, ["checkout.session.expired"], ago(ctx.now, 3 * DAY))).filter((e) => e.receivedAt <= ago(ctx.now, DAY));
  if (!expired.length) return [];
  const completed = await events(ctx.db, ["checkout.session.completed"], ago(ctx.now, 5 * DAY));
  const out: QueuedEmail[] = [];
  const seen = new Set<string>();
  for (const e of expired) {
    const meta = (e.object.metadata as Obj | undefined) ?? {};
    const householdId = str(meta.household_id) ?? str(e.object.client_reference_id);
    const userId = str(meta.adult_id);
    if (!householdId || !userId || seen.has(householdId)) continue;
    seen.add(householdId);
    if (completed.some((c) => c.receivedAt > e.receivedAt && (str((c.object.metadata as Obj | undefined)?.household_id) ?? str(c.object.client_reference_id)) === householdId)) continue;
    const isPlan = !str(meta.item)?.startsWith("credit_pack");
    if (isPlan) {
      const plans = await q(ctx.db.from("household_entitlements").select("id, source, ends_at").eq("household_id", householdId).eq("status", "active"), "read plans");
      if (plans.some((p) => p.source !== "trial" && (!p.ends_at || (p.ends_at as string) > ctx.now.toISOString()))) continue;
    }
    const recent = await q(ctx.db.from("email_outbox").select("id").eq("email_id", "K1").eq("recipient_user_id", userId).gte("created_at", ago(ctx.now, 30 * DAY)).limit(1), "read recent K1");
    if (recent.length) continue;
    const names = await q(ctx.db.from("adult_profiles").select("display_name").eq("user_id", userId).limit(1), "read name");
    out.push({
      emailId: "K1",
      dedupeKey: `K1:${ref(e.object.id) ?? householdId}`,
      to: { userId },
      householdId,
      message: readliEmail({
        subject: isPlan ? "Still want Readli for your family?" : "Your credits are waiting",
        name: String(names[0]?.display_name ?? "").trim().split(/\s+/)[0] ?? "",
        title: isPlan ? "Your Readli Family checkout didn't finish" : "Your credit pack checkout didn't finish",
        paragraphs: [
          isPlan
            ? "You were so close! If you'd still like stories read in the voices your kids love, you can pick up right where you left off."
            : "Your credit pack is still in the cart. Pick it up any time from Billing and get the next story ready.",
        ],
        cta: { label: "Go to Billing", url: `${ctx.base}/family/billing` },
        reason: "You're getting this because you asked for Readli news and offers.",
        preferencesUrl: preferencesUrl(ctx.base, ctx.secret, userId),
        headers: unsubscribeHeaders(ctx.base, ctx.secret, userId, "marketing"),
        footerLabel: "Unsubscribe or change your email settings",
      }),
    });
  }
  return out;
}

/** Queues every switched-on billing email now due. */
export async function queueBillingEmails(ctx: BillingContext): Promise<{ queued: number; errors: string[] }> {
  const errors: string[] = [];
  const all: QueuedEmail[] = [];
  for (const [id, run] of [
    ["T1", trialEnding],
    ["T2", trialCreditsLow],
    ["B1", yearlyRenewal],
    ["B2", giftEnding],
    ["K1", abandonedCheckout],
  ] as const) {
    try {
      all.push(...(await run(ctx)));
    } catch (err) {
      errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { queued: (await queueEmails(ctx.db, ctx.secret, all, ctx.now)).length, errors };
}
